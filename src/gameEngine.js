import { DEFAULT_SETTINGS } from "./config.js";
import { buildChallengeDeck, drawChallengeForMode } from "./challenges.js";

const FIXED_STEAL_VALUE = 10;

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

function normalizeAnswer(value) {
  return normalizeUpper(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ç/g, "C");
}

export function sanitizeSettings(input = {}) {
  const gameMode = String(input.gameMode || DEFAULT_SETTINGS.gameMode).toUpperCase();
  return {
    initialPoints: Math.max(10, toInt(input.initialPoints, DEFAULT_SETTINGS.initialPoints)),
    victoryGoal: Math.max(50, toInt(input.victoryGoal, DEFAULT_SETTINGS.victoryGoal)),
    gameMode: gameMode === "WORDS_MATH" ? "WORDS_MATH" : "WORDS",
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
    finishOrder: [],
    eliminationOrder: [],
    totalPlayers: 1,
    lastAction: null
  };
}

export function createPlayer({ id, name, socketId, isHost = false }) {
  return {
    id,
    socketId,
    reconnectKey: null,
    connected: true,
    networkKey: null,
    name: normalizeUpper(name),
    isHost,
    points: 0,
    status: "alive",
    statusAt: null,
    result: null,
    totalStolen: 0,
    successfulAttacks: 0,
    failedAttacks: 0,
    receivedFrom: {},
    lostTo: {}
  };
}

function buildPlacementRanking(room) {
  const players = [...room.players.values()];
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));

  const finished = room.finishOrder.filter((id) => byId[id]);
  const alive = players
    .filter((p) => p.status === "alive")
    .sort((a, b) => b.points - a.points)
    .map((p) => p.id);
  const eliminated = [...room.eliminationOrder].reverse().filter((id) => byId[id]);

  const orderedIds = [...finished, ...alive, ...eliminated];
  const total = room.totalPlayers || orderedIds.length;

  const entries = orderedIds.map((id, index) => {
    const player = byId[id];
    return {
      position: index + 1,
      outOf: total,
      playerId: player.id,
      playerName: player.name,
      status: player.status,
      points: player.points
    };
  });

  return { totalPlayers: total, entries };
}

function buildAttackRanking(room) {
  return [...room.players.values()]
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
}

function buildPersonalReport(room) {
  const players = [...room.players.values()];
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));

  return Object.fromEntries(
    players.map((p) => {
      const byAttacker = Object.entries(p.lostTo)
        .map(([attackerId, points]) => ({
          attackerId,
          attackerName: byId[attackerId]?.name || "ALGUEM",
          points
        }))
        .sort((a, b) => b.points - a.points);

      return [
        p.id,
        {
          playerId: p.id,
          playerName: p.name,
          totalLost: byAttacker.reduce((sum, row) => sum + row.points, 0),
          byAttacker
        }
      ];
    })
  );
}

export function buildRankingSnapshot(room) {
  return buildPlacementRanking(room);
}

function buildFinalReport(room, winnerId, reason) {
  return {
    winnerId,
    reason,
    placementRanking: buildPlacementRanking(room),
    attackRanking: buildAttackRanking(room),
    personal: buildPersonalReport(room)
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
    ranking: buildRankingSnapshot(room),
    lastAction: room.lastAction
  };
}

export function startGame(room) {
  room.status = "in_game";
  room.activeChallenges.clear();
  room.challengeDeck = buildChallengeDeck();
  room.attackLog = [];
  room.finishOrder = [];
  room.eliminationOrder = [];
  room.totalPlayers = room.players.size;
  room.lastAction = null;

  for (const player of room.players.values()) {
    player.points = room.settings.initialPoints;
    player.status = "alive";
    player.statusAt = null;
    player.connected = Boolean(player.socketId);
    player.result = null;
    player.totalStolen = 0;
    player.successfulAttacks = 0;
    player.failedAttacks = 0;
    player.receivedFrom = {};
    player.lostTo = {};
  }
}

export function addPlayerToRunningGame(room, player) {
  if (room.status !== "in_game") {
    return;
  }
  player.points = room.settings.initialPoints;
  player.status = "alive";
  room.totalPlayers = Math.max(room.totalPlayers, room.players.size);
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
  if (attacker.status !== "alive") {
    return { ok: false, reason: "Você não está ativo na partida" };
  }
  if (target.status !== "alive") {
    return { ok: false, reason: "Este jogador não está mais ativo" };
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
  return drawChallengeForMode(room.challengeDeck, room.settings.gameMode);
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
    answerType: challenge.answerType || "text",
    answer: challenge.answer || null,
    answerKey: challenge.answer ? normalizeAnswer(challenge.answer) : null,
    numericAnswer: typeof challenge.numericAnswer === "number" ? challenge.numericAnswer : null,
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

function evaluateSteal(targetPoints) {
  return Math.min(FIXED_STEAL_VALUE, Math.max(0, targetPoints));
}

function resolveSuccess(room, challenge, now) {
  const attacker = room.players.get(challenge.attackerId);
  const target = room.players.get(challenge.targetId);
  if (!attacker || !target) {
    return null;
  }

  const steal = evaluateSteal(target.points);
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

  room.attackLog.push({ type: "success", attackerId: attacker.id, targetId: target.id, value: steal, at: now });

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

  room.lastAction = { type: "success", attackerId: attacker.id, targetId: target.id, value: steal, at: now };
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
    byQuit: true,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

  room.attackLog.push({ type: "failure", attackerId: attacker.id, targetId: target.id, value: cost, at: now });

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

  room.lastAction = { type: "failure", attackerId: attacker.id, targetId: target.id, value: cost, at: now };
  return payload;
}

function closeChallenge(room, attackerId) {
  room.activeChallenges.delete(attackerId);
}

function markProgressTransitions(room, playerIds, now) {
  const transitions = [];

  for (const id of playerIds) {
    const player = room.players.get(id);
    if (!player || player.status !== "alive") {
      continue;
    }

    if (player.points <= 0) {
      player.points = 0;
      player.status = "eliminated";
      player.statusAt = now;
      if (!room.eliminationOrder.includes(player.id)) {
        room.eliminationOrder.push(player.id);
      }
      transitions.push({ playerId: player.id, type: "eliminated" });
      continue;
    }

    if (player.points >= room.settings.victoryGoal) {
      player.status = "finished";
      player.statusAt = now;
      if (!room.finishOrder.includes(player.id)) {
        room.finishOrder.push(player.id);
      }
      transitions.push({ playerId: player.id, type: "finished" });
    }
  }

  if (!transitions.length) {
    return transitions;
  }

  const ranking = buildPlacementRanking(room);
  return transitions.map((item) => {
    const row = ranking.entries.find((entry) => entry.playerId === item.playerId);
    return {
      ...item,
      position: row?.position ?? null,
      outOf: ranking.totalPlayers
    };
  });
}

function finalizeResolvedAction(room, result, actorIds, now) {
  const transitions = markProgressTransitions(room, actorIds, now);
  return {
    result,
    transitions,
    ranking: buildRankingSnapshot(room)
  };
}

export function submitAnswer(room, attackerId, answer, now) {
  const challenge = room.activeChallenges.get(attackerId);
  if (!challenge || challenge.resolved) {
    return { ok: false, reason: "Desafio não encontrado" };
  }

  const rawAnswer = String(answer || "").trim();
  if (!rawAnswer) {
    return { ok: false, reason: "Resposta vazia" };
  }

  let matched = false;
  if (challenge.answerType === "number") {
    const numeric = Number(rawAnswer.replace(",", "."));
    if (Number.isFinite(numeric) && challenge.numericAnswer !== null) {
      matched = Math.abs(numeric - challenge.numericAnswer) < 0.0001;
    }
  } else {
    const cleanAnswer = normalizeAnswer(rawAnswer);
    matched = cleanAnswer === challenge.answerKey;
  }

  if (matched) {
    challenge.resolved = true;
    const result = resolveSuccess(room, challenge, now);
    closeChallenge(room, attackerId);
    return {
      ok: true,
      resolved: true,
      ...finalizeResolvedAction(room, result, [challenge.attackerId, challenge.targetId], now)
    };
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

  return {
    ok: true,
    resolved: true,
    ...finalizeResolvedAction(room, result, [challenge.attackerId, challenge.targetId], now)
  };
}

export function evaluateGameOver(room) {
  if (room.status !== "in_game") {
    return { finished: false };
  }

  const alivePlayers = [...room.players.values()].filter((p) => p.status === "alive");
  if (alivePlayers.length > 1) {
    return { finished: false };
  }

  // If only one player remains active, finalize placement to prevent deadlock
  // where no valid targets are left for attacks.
  if (alivePlayers.length === 1) {
    const survivor = alivePlayers[0];
    survivor.status = "finished";
    if (!room.finishOrder.includes(survivor.id)) {
      room.finishOrder.push(survivor.id);
    }
  }

  room.status = "finished";
  const winnerId = room.finishOrder[0] || buildPlacementRanking(room).entries[0]?.playerId || null;

  return {
    finished: true,
    winnerId,
    reason: "all_resolved",
    report: buildFinalReport(room, winnerId, "all_resolved")
  };
}

export function finishGameByHost(room, hostId) {
  if (room.hostId !== hostId) {
    return { ok: false, reason: "Só o host pode finalizar a partida" };
  }
  if (room.status !== "in_game") {
    return { ok: false, reason: "A partida não está em andamento" };
  }

  room.status = "finished";
  const winnerId = room.finishOrder[0] || buildPlacementRanking(room).entries[0]?.playerId || null;

  return {
    ok: true,
    finished: true,
    winnerId,
    reason: "host_forced",
    report: buildFinalReport(room, winnerId, "host_forced")
  };
}

export function resetGameToLobby(room, hostId) {
  if (room.hostId !== hostId) {
    return { ok: false, reason: "Só o host pode reiniciar a partida" };
  }

  room.status = "lobby";
  room.activeChallenges.clear();
  room.challengeDeck = buildChallengeDeck();
  room.attackLog = [];
  room.finishOrder = [];
  room.eliminationOrder = [];
  room.lastAction = null;
  room.totalPlayers = room.players.size;

  for (const player of room.players.values()) {
    player.points = 0;
    player.status = "alive";
    player.statusAt = null;
    player.result = null;
    player.totalStolen = 0;
    player.successfulAttacks = 0;
    player.failedAttacks = 0;
    player.receivedFrom = {};
    player.lostTo = {};
  }

  return { ok: true };
}
