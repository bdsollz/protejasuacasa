import { DEFAULT_SETTINGS } from "./config.js";
import { buildChallengeDeck, drawFromDeck } from "./challenges.js";

const HARD_STEAL_CAP = 10;

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function incCounter(obj, key, value) {
  const current = Number(obj[key] || 0);
  obj[key] = current + value;
}

export function normalizeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

export function sanitizeSettings(input = {}) {
  return {
    initialPoints: Math.max(10, toInt(input.initialPoints, DEFAULT_SETTINGS.initialPoints)),
    victoryGoal: Math.max(50, toInt(input.victoryGoal, DEFAULT_SETTINGS.victoryGoal)),
    fixedStealCap: Math.max(5, toInt(input.fixedStealCap, DEFAULT_SETTINGS.fixedStealCap)),
    percentStealCap: Math.min(0.5, Math.max(0.05, Number(input.percentStealCap ?? DEFAULT_SETTINGS.percentStealCap))),
    baseStealValue: Math.max(3, toInt(input.baseStealValue, DEFAULT_SETTINGS.baseStealValue)),
    failCost: Math.max(1, toInt(input.failCost, DEFAULT_SETTINGS.failCost))
  };
}

export function createRoom(roomCode, hostPlayer) {
  return {
    code: roomCode,
    status: "lobby",
    hostId: hostPlayer.id,
    settings: sanitizeSettings(),
    players: new Map([[hostPlayer.id, hostPlayer]]),
    activeChallenges: new Map(),
    challengeDeck: buildChallengeDeck(),
    attackLog: [],
    lastAction: null,
    hostNetworkKey: null,
    location: null
  };
}

export function createPlayer({ id, name, socketId, isHost = false }) {
  return {
    id,
    socketId,
    reconnectKey: null,
    connected: true,
    name: normalizeUpper(name),
    isHost,
    points: 0,
    status: "alive",
    result: null,
    totalStolen: 0,
    successfulAttacks: 0,
    failedAttacks: 0,
    receivedFrom: {},
    lostTo: {}
  };
}

export function roomSnapshot(room) {
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
    connected: Boolean(p.connected),
    points: p.points,
    status: p.status
  }));

  return {
    code: room.code,
    status: room.status,
    settings: room.settings,
    players,
    lastAction: room.lastAction,
    location: room.location
  };
}

export function startGame(room) {
  room.status = "in_game";
  room.activeChallenges.clear();
  room.challengeDeck = buildChallengeDeck();
  room.attackLog = [];
  room.lastAction = null;

  for (const player of room.players.values()) {
    player.points = room.settings.initialPoints;
    player.status = "alive";
    player.connected = Boolean(player.socketId);
    player.result = null;
    player.totalStolen = 0;
    player.successfulAttacks = 0;
    player.failedAttacks = 0;
    player.receivedFrom = {};
    player.lostTo = {};
  }
}

function evaluateSteal(room, targetPoints) {
  if (targetPoints <= 0) {
    return 0;
  }
  const percentCap = Math.floor(targetPoints * room.settings.percentStealCap);
  const capByRules = Math.min(HARD_STEAL_CAP, room.settings.fixedStealCap, percentCap, room.settings.baseStealValue);
  return Math.max(1, Math.min(capByRules, targetPoints));
}

export function canTarget(room, attackerId, targetId) {
  const attacker = room.players.get(attackerId);
  const target = room.players.get(targetId);

  if (!attacker || !target) {
    return { ok: false, reason: "Jogador inválido" };
  }
  if (room.status !== "in_game") {
    return { ok: false, reason: "Partida não está em andamento" };
  }
  if (attackerId === targetId) {
    return { ok: false, reason: "Não pode pegar pontos da própria casa" };
  }
  if (room.activeChallenges.has(attackerId)) {
    return { ok: false, reason: "Finalize seu desafio atual" };
  }

  return { ok: true };
}

function drawChallenge(room) {
  if (!room.challengeDeck.length) {
    room.challengeDeck = buildChallengeDeck();
  }
  return drawFromDeck(room.challengeDeck);
}

export function startInvasion(room, attackerId, targetId) {
  const valid = canTarget(room, attackerId, targetId);
  if (!valid.ok) {
    return valid;
  }

  const challenge = drawChallenge(room);
  if (!challenge) {
    return { ok: false, reason: "Sem charadas disponíveis" };
  }

  room.activeChallenges.set(attackerId, {
    attackerId,
    targetId,
    answer: challenge.answer,
    hint: challenge.hint,
    masked: challenge.masked,
    resolved: false
  });

  return {
    ok: true,
    challenge: {
      targetId,
      hint: challenge.hint,
      masked: challenge.masked
    }
  };
}

function resolveSuccess(room, challenge, now) {
  const attacker = room.players.get(challenge.attackerId);
  const target = room.players.get(challenge.targetId);

  if (!attacker || !target) {
    return null;
  }

  const steal = evaluateSteal(room, target.points);
  target.points -= steal;
  attacker.points += steal;

  attacker.totalStolen += steal;
  attacker.successfulAttacks += 1;
  incCounter(attacker.receivedFrom, target.id, steal);
  incCounter(target.lostTo, attacker.id, steal);

  const payload = {
    attackerId: attacker.id,
    targetId: target.id,
    success: true,
    value: steal,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

  room.attackLog.push({
    type: "success",
    attackerId: attacker.id,
    targetId: target.id,
    value: steal,
    at: now
  });

  attacker.result = payload;
  target.result = {
    attackerId: attacker.id,
    targetId: target.id,
    success: false,
    value: -steal,
    suffered: true,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

  room.lastAction = {
    type: "success",
    attackerId: attacker.id,
    targetId: target.id,
    value: steal,
    at: now
  };

  return payload;
}

function resolveFailure(room, challenge, now) {
  const attacker = room.players.get(challenge.attackerId);
  const target = room.players.get(challenge.targetId);

  if (!attacker || !target) {
    return null;
  }

  const capCost = Math.max(0, attacker.points - 1);
  const cost = Math.min(room.settings.failCost, capCost);

  attacker.points -= cost;
  target.points += cost;
  attacker.failedAttacks += 1;

  const payload = {
    attackerId: attacker.id,
    targetId: target.id,
    success: false,
    value: cost,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

  room.attackLog.push({
    type: "failure",
    attackerId: attacker.id,
    targetId: target.id,
    value: cost,
    at: now
  });

  attacker.result = payload;
  target.result = {
    attackerId: attacker.id,
    targetId: target.id,
    success: true,
    value: +cost,
    defended: true,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

  room.lastAction = {
    type: "failure",
    attackerId: attacker.id,
    targetId: target.id,
    value: cost,
    at: now
  };

  return payload;
}

function closeChallenge(room, attackerId) {
  room.activeChallenges.delete(attackerId);
}

export function submitAnswer(room, attackerId, answer, now) {
  const challenge = room.activeChallenges.get(attackerId);
  if (!challenge || challenge.resolved) {
    return { ok: false, reason: "Desafio não encontrado" };
  }

  const cleanAnswer = normalizeUpper(answer);
  if (!cleanAnswer) {
    return { ok: false, reason: "Resposta vazia" };
  }

  if (cleanAnswer === challenge.answer) {
    challenge.resolved = true;
    const result = resolveSuccess(room, challenge, now);
    closeChallenge(room, attackerId);
    return { ok: true, resolved: true, result };
  }

  return { ok: true, resolved: false };
}

export function quitChallenge(room, attackerId, now) {
  const challenge = room.activeChallenges.get(attackerId);
  if (!challenge || challenge.resolved) {
    return { ok: false, reason: "Desafio não encontrado" };
  }

  challenge.resolved = true;
  const result = resolveFailure(room, challenge, now);
  closeChallenge(room, attackerId);
  return { ok: true, resolved: true, result };
}

function buildReport(room, winnerId, reason) {
  const players = [...room.players.values()];
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  const personal = Object.fromEntries(
    players.map((p) => {
      const entries = Object.entries(p.lostTo)
        .map(([attackerId, points]) => ({
          attackerId,
          attackerName: playersById[attackerId]?.name || "ALGUEM",
          points
        }))
        .sort((a, b) => b.points - a.points);

      return [
        p.id,
        {
          playerId: p.id,
          playerName: p.name,
          totalLost: entries.reduce((sum, item) => sum + item.points, 0),
          byAttacker: entries
        }
      ];
    })
  );

  const ranking = players
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      totalStolen: p.totalStolen,
      successfulAttacks: p.successfulAttacks,
      failedAttacks: p.failedAttacks
    }))
    .sort((a, b) => {
      if (b.totalStolen !== a.totalStolen) return b.totalStolen - a.totalStolen;
      if (b.successfulAttacks !== a.successfulAttacks) return b.successfulAttacks - a.successfulAttacks;
      return a.failedAttacks - b.failedAttacks;
    });

  return {
    winnerId,
    reason,
    ranking,
    personal
  };
}

export function evaluateGameOver(room) {
  const players = [...room.players.values()];
  const winnerByGoal = players.find((p) => p.points >= room.settings.victoryGoal);

  if (winnerByGoal) {
    room.status = "finished";
    return {
      finished: true,
      winnerId: winnerByGoal.id,
      reason: "goal",
      report: buildReport(room, winnerByGoal.id, "goal")
    };
  }

  return { finished: false };
}

export function finishGameByHost(room, hostId) {
  if (room.hostId !== hostId) {
    return { ok: false, reason: "Só o host pode finalizar a partida" };
  }
  if (room.status !== "in_game") {
    return { ok: false, reason: "A partida não está em andamento" };
  }

  const leader = [...room.players.values()].sort((a, b) => b.points - a.points)[0] || null;
  room.status = "finished";

  return {
    ok: true,
    finished: true,
    winnerId: leader?.id ?? null,
    reason: "host_forced",
    report: buildReport(room, leader?.id ?? null, "host_forced")
  };
}
