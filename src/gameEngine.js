import { DEFAULT_SETTINGS } from "./config.js";
import { drawChallenge } from "./challenges.js";

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function normalizeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

export function sanitizeSettings(input = {}) {
  return {
    initialPoints: Math.max(10, toInt(input.initialPoints, DEFAULT_SETTINGS.initialPoints)),
    victoryGoal: Math.max(50, toInt(input.victoryGoal, DEFAULT_SETTINGS.victoryGoal)),
    maxAttempts: Math.max(1, toInt(input.maxAttempts, DEFAULT_SETTINGS.maxAttempts)),
    fixedStealCap: Math.max(5, toInt(input.fixedStealCap, DEFAULT_SETTINGS.fixedStealCap)),
    percentStealCap: Math.min(0.5, Math.max(0.05, Number(input.percentStealCap ?? DEFAULT_SETTINGS.percentStealCap))),
    baseStealValue: Math.max(3, toInt(input.baseStealValue, DEFAULT_SETTINGS.baseStealValue)),
    failCost: Math.max(1, toInt(input.failCost, DEFAULT_SETTINGS.failCost)),
    shieldSeconds: Math.max(0, toInt(input.shieldSeconds, DEFAULT_SETTINGS.shieldSeconds))
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
    lastAction: null
  };
}

export function createPlayer({ id, name, socketId, isHost = false }) {
  return {
    id,
    socketId,
    name: normalizeUpper(name),
    isHost,
    points: 0,
    status: "alive",
    shieldUntilTs: 0,
    result: null
  };
}

export function roomSnapshot(room) {
  const now = Date.now();
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
    points: p.points,
    status: p.status,
    shieldActive: now < p.shieldUntilTs
  }));

  return {
    code: room.code,
    status: room.status,
    settings: room.settings,
    players,
    lastAction: room.lastAction
  };
}

export function startGame(room) {
  room.status = "in_game";
  room.activeChallenges.clear();

  for (const player of room.players.values()) {
    player.points = room.settings.initialPoints;
    player.status = "alive";
    player.shieldUntilTs = 0;
    player.result = null;
  }
}

function evaluateSteal(room, targetPoints) {
  const percentCap = Math.floor(targetPoints * room.settings.percentStealCap);
  return Math.max(1, Math.min(room.settings.fixedStealCap, percentCap, room.settings.baseStealValue, targetPoints));
}

function eliminateIfNeeded(player) {
  if (player.points <= 0) {
    player.points = 0;
    player.status = "eliminated";
  }
}

export function canTarget(room, attackerId, targetId, now) {
  const attacker = room.players.get(attackerId);
  const target = room.players.get(targetId);

  if (!attacker || !target) {
    return { ok: false, reason: "Jogador inválido" };
  }
  if (room.status !== "in_game") {
    return { ok: false, reason: "Partida não está em andamento" };
  }
  if (attacker.status !== "alive") {
    return { ok: false, reason: "Jogador eliminado" };
  }
  if (target.status !== "alive") {
    return { ok: false, reason: "Alvo eliminado" };
  }
  if (attackerId === targetId) {
    return { ok: false, reason: "Não pode invadir a própria casa" };
  }
  if (now < target.shieldUntilTs) {
    return { ok: false, reason: "Casa protegida por escudo" };
  }
  if (room.activeChallenges.has(attackerId)) {
    return { ok: false, reason: "Finalize seu desafio atual" };
  }

  return { ok: true };
}

export function startInvasion(room, attackerId, targetId, now) {
  const valid = canTarget(room, attackerId, targetId, now);
  if (!valid.ok) {
    return valid;
  }

  const challenge = drawChallenge();
  room.activeChallenges.set(attackerId, {
    attackerId,
    targetId,
    answer: challenge.answer,
    hint: challenge.hint,
    masked: challenge.masked,
    attemptsLeft: room.settings.maxAttempts,
    resolved: false
  });

  return {
    ok: true,
    challenge: {
      targetId,
      hint: challenge.hint,
      masked: challenge.masked,
      attemptsLeft: room.settings.maxAttempts
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
  target.shieldUntilTs = now + room.settings.shieldSeconds * 1000;

  eliminateIfNeeded(target);

  const payload = {
    attackerId: attacker.id,
    targetId: target.id,
    success: true,
    value: steal,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

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
  target.shieldUntilTs = now + room.settings.shieldSeconds * 1000;

  eliminateIfNeeded(attacker);

  const payload = {
    attackerId: attacker.id,
    targetId: target.id,
    success: false,
    value: cost,
    attackerAfter: attacker.points,
    targetAfter: target.points
  };

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

  challenge.attemptsLeft -= 1;
  if (challenge.attemptsLeft <= 0) {
    challenge.resolved = true;
    const result = resolveFailure(room, challenge, now);
    closeChallenge(room, attackerId);
    return { ok: true, resolved: true, result };
  }

  return { ok: true, resolved: false, attemptsLeft: challenge.attemptsLeft };
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

export function evaluateGameOver(room) {
  const alive = [...room.players.values()].filter((p) => p.status === "alive");
  const winnerByGoal = alive.find((p) => p.points >= room.settings.victoryGoal);

  if (winnerByGoal) {
    room.status = "finished";
    return { finished: true, winnerId: winnerByGoal.id, reason: "goal" };
  }

  if (alive.length <= 1) {
    room.status = "finished";
    return { finished: true, winnerId: alive[0]?.id ?? null, reason: "last_alive" };
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

  const alive = [...room.players.values()]
    .filter((p) => p.status === "alive")
    .sort((a, b) => b.points - a.points);

  room.status = "finished";
  return { ok: true, finished: true, winnerId: alive[0]?.id ?? null, reason: "host_forced" };
}
