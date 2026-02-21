import { DEFAULT_SETTINGS } from "./config.js";
import { drawChallenge } from "./challenges.js";

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function sanitizeSettings(input = {}) {
  return {
    initialPoints: Math.max(10, toInt(input.initialPoints, DEFAULT_SETTINGS.initialPoints)),
    victoryGoal: Math.max(50, toInt(input.victoryGoal, DEFAULT_SETTINGS.victoryGoal)),
    planningSeconds: Math.max(5, toInt(input.planningSeconds, DEFAULT_SETTINGS.planningSeconds)),
    challengeSeconds: Math.max(8, toInt(input.challengeSeconds, DEFAULT_SETTINGS.challengeSeconds)),
    resultSeconds: Math.max(3, toInt(input.resultSeconds, DEFAULT_SETTINGS.resultSeconds)),
    maxAttempts: Math.max(1, toInt(input.maxAttempts, DEFAULT_SETTINGS.maxAttempts)),
    fixedStealCap: Math.max(5, toInt(input.fixedStealCap, DEFAULT_SETTINGS.fixedStealCap)),
    percentStealCap: Math.min(0.5, Math.max(0.05, Number(input.percentStealCap ?? DEFAULT_SETTINGS.percentStealCap))),
    baseStealValue: Math.max(3, toInt(input.baseStealValue, DEFAULT_SETTINGS.baseStealValue)),
    failCost: Math.max(1, toInt(input.failCost, DEFAULT_SETTINGS.failCost)),
    shieldRounds: Math.max(1, toInt(input.shieldRounds, DEFAULT_SETTINGS.shieldRounds))
  };
}

export function createRoom(roomCode, hostPlayer) {
  return {
    code: roomCode,
    status: "lobby",
    round: 0,
    phase: "lobby",
    phaseEndsAt: null,
    hostId: hostPlayer.id,
    settings: sanitizeSettings(),
    players: new Map([[hostPlayer.id, hostPlayer]]),
    plannedActions: new Map(),
    activeChallenges: new Map(),
    lastRoundEvents: []
  };
}

export function createPlayer({ id, name, socketId, isHost = false }) {
  return {
    id,
    socketId,
    name,
    isHost,
    points: 0,
    status: "alive",
    shieldUntilRound: 0,
    lastTargetId: null,
    lastTargetRound: null,
    result: null
  };
}

export function roomSnapshot(room, revealAnswers = false) {
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
    points: p.points,
    status: p.status,
    shieldActive: room.round <= p.shieldUntilRound
  }));

  const base = {
    code: room.code,
    status: room.status,
    round: room.round,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    settings: room.settings,
    players,
    lastRoundEvents: room.lastRoundEvents
  };

  if (!revealAnswers) {
    return base;
  }

  return {
    ...base,
    activeChallenges: [...room.activeChallenges.entries()].map(([attackerId, c]) => ({
      attackerId,
      targetId: c.targetId,
      answer: c.answer,
      masked: c.masked,
      attemptsLeft: c.attemptsLeft,
      deadline: c.deadline
    }))
  };
}

export function startGame(room) {
  room.status = "in_game";
  room.round = 1;
  room.phase = "planning";
  room.phaseEndsAt = null;
  room.plannedActions.clear();
  room.activeChallenges.clear();

  for (const player of room.players.values()) {
    player.points = room.settings.initialPoints;
    player.status = "alive";
    player.shieldUntilRound = 0;
    player.lastTargetId = null;
    player.lastTargetRound = null;
    player.result = null;
  }
}

export function startPlanning(room, now, ms) {
  room.phase = "planning";
  room.phaseEndsAt = now + ms;
  room.plannedActions.clear();

  for (const player of room.players.values()) {
    player.result = null;
  }
}

export function canTarget(room, attackerId, targetId) {
  const attacker = room.players.get(attackerId);
  const target = room.players.get(targetId);

  if (!attacker || !target) {
    return { ok: false, reason: "Jogador inválido" };
  }
  if (room.phase !== "planning") {
    return { ok: false, reason: "Fase de planejamento encerrada" };
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
  if (room.round <= target.shieldUntilRound) {
    return { ok: false, reason: "Casa protegida por escudo" };
  }
  if (attacker.lastTargetId === targetId && attacker.lastTargetRound === room.round - 1) {
    return { ok: false, reason: "Não pode invadir o mesmo alvo em rodadas consecutivas" };
  }

  return { ok: true };
}

export function planInvasion(room, attackerId, targetId) {
  const validity = canTarget(room, attackerId, targetId);
  if (!validity.ok) {
    return validity;
  }

  room.plannedActions.set(attackerId, { type: "invade", targetId });
  return { ok: true };
}

export function startExecution(room, now, ms) {
  room.phase = "execution";
  room.phaseEndsAt = now + ms;
  room.activeChallenges.clear();

  for (const [attackerId, action] of room.plannedActions.entries()) {
    if (action.type !== "invade") {
      continue;
    }
    const attacker = room.players.get(attackerId);
    const target = room.players.get(action.targetId);

    if (!attacker || !target || attacker.status !== "alive" || target.status !== "alive") {
      continue;
    }

    const challenge = drawChallenge();
    room.activeChallenges.set(attackerId, {
      attackerId,
      targetId: target.id,
      answer: challenge.answer,
      hint: challenge.hint,
      masked: challenge.masked,
      attemptsLeft: room.settings.maxAttempts,
      startedAt: now,
      deadline: now + ms,
      resolved: false
    });

    attacker.lastTargetId = target.id;
    attacker.lastTargetRound = room.round;
  }
}

function performanceMultiplier(elapsedSec) {
  if (elapsedSec <= 5) {
    return 1.3;
  }
  if (elapsedSec <= 10) {
    return 1;
  }
  return 0.7;
}

function evaluateSteal(room, targetPoints, elapsedSec) {
  const base = Math.round(room.settings.baseStealValue * performanceMultiplier(elapsedSec));
  const percentCap = Math.floor(targetPoints * room.settings.percentStealCap);
  const steal = Math.max(1, Math.min(room.settings.fixedStealCap, percentCap, base, targetPoints));
  return steal;
}

function eliminateIfNeeded(player) {
  if (player.points <= 0) {
    player.points = 0;
    player.status = "eliminated";
  }
}

function resolveSuccess(room, challenge, now) {
  const attacker = room.players.get(challenge.attackerId);
  const target = room.players.get(challenge.targetId);

  if (!attacker || !target) {
    return null;
  }

  const elapsedSec = Math.max(0, (now - challenge.startedAt) / 1000);
  const steal = evaluateSteal(room, target.points, elapsedSec);

  target.points -= steal;
  attacker.points += steal;
  target.shieldUntilRound = room.round + room.settings.shieldRounds;

  eliminateIfNeeded(target);

  const payload = {
    attackerId: attacker.id,
    targetId: target.id,
    success: true,
    value: steal,
    elapsedSec: Number(elapsedSec.toFixed(2)),
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

  return payload;
}

function resolveFailure(room, challenge) {
  const attacker = room.players.get(challenge.attackerId);
  const target = room.players.get(challenge.targetId);

  if (!attacker || !target) {
    return null;
  }

  const capCost = Math.max(0, attacker.points - 1);
  const cost = Math.min(room.settings.failCost, capCost);

  attacker.points -= cost;
  target.points += cost;
  target.shieldUntilRound = room.round + room.settings.shieldRounds;

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

  return payload;
}

export function quitChallenge(room, attackerId) {
  if (room.phase !== "execution") {
    return { ok: false, reason: "Não está em fase de desafio" };
  }

  const challenge = room.activeChallenges.get(attackerId);
  if (!challenge || challenge.resolved) {
    return { ok: false, reason: "Desafio não encontrado" };
  }

  challenge.resolved = true;
  const result = resolveFailure(room, challenge);
  return { ok: true, resolved: true, result };
}

export function submitAnswer(room, attackerId, answer, now) {
  if (room.phase !== "execution") {
    return { ok: false, reason: "Não está em fase de desafio" };
  }

  const challenge = room.activeChallenges.get(attackerId);
  if (!challenge || challenge.resolved) {
    return { ok: false, reason: "Desafio não encontrado" };
  }

  const cleanAnswer = String(answer || "").trim().toUpperCase();
  if (!cleanAnswer) {
    return { ok: false, reason: "Resposta vazia" };
  }

  if (now > challenge.deadline) {
    challenge.resolved = true;
    const result = resolveFailure(room, challenge);
    return { ok: true, resolved: true, result };
  }

  if (cleanAnswer === challenge.answer) {
    challenge.resolved = true;
    const result = resolveSuccess(room, challenge, now);
    return { ok: true, resolved: true, result };
  }

  challenge.attemptsLeft -= 1;
  if (challenge.attemptsLeft <= 0) {
    challenge.resolved = true;
    const result = resolveFailure(room, challenge);
    return { ok: true, resolved: true, result };
  }

  return { ok: true, resolved: false, attemptsLeft: challenge.attemptsLeft };
}

export function finalizeExecution(room, now) {
  const events = [];
  for (const challenge of room.activeChallenges.values()) {
    if (challenge.resolved) {
      continue;
    }
    if (now >= challenge.deadline) {
      challenge.resolved = true;
      const ev = resolveFailure(room, challenge);
      if (ev) {
        events.push(ev);
      }
    }
  }
  room.lastRoundEvents = events;
}

export function resolveRoundEnd(room) {
  const alive = [...room.players.values()].filter((p) => p.status === "alive");
  const winnerByGoal = alive.find((p) => p.points >= room.settings.victoryGoal);

  if (winnerByGoal) {
    room.status = "finished";
    room.phase = "finished";
    return { finished: true, winnerId: winnerByGoal.id, reason: "goal" };
  }

  if (alive.length <= 1) {
    room.status = "finished";
    room.phase = "finished";
    return { finished: true, winnerId: alive[0]?.id ?? null, reason: "last_alive" };
  }

  room.round += 1;
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
  room.phase = "finished";
  room.phaseEndsAt = null;
  return { ok: true, finished: true, winnerId: alive[0]?.id ?? null, reason: "host_forced" };
}
