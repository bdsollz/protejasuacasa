import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayer,
  createRoom,
  evaluateGameOver,
  finishGameByHost,
  normalizeUpper,
  quitChallenge,
  sanitizeSettings,
  startGame,
  startInvasion,
  submitAnswer
} from "../src/gameEngine.js";

function setupRoom() {
  const p1 = createPlayer({ id: "p1", name: "a", socketId: "p1", isHost: true });
  const p2 = createPlayer({ id: "p2", name: "b", socketId: "p2" });
  const room = createRoom("ABC123", p1);
  room.players.set(p2.id, p2);
  room.settings = sanitizeSettings({
    initialPoints: 100,
    fixedStealCap: 25,
    percentStealCap: 0.2,
    baseStealValue: 18,
    maxAttempts: 3,
    failCost: 8,
    shieldSeconds: 12
  });
  startGame(room);
  return room;
}

test("normaliza textos para maiúsculo", () => {
  assert.equal(normalizeUpper(" abc12 "), "ABC12");
});

test("roubo respeita teto percentual do alvo", () => {
  const room = setupRoom();
  room.players.get("p2").points = 60;

  const started = startInvasion(room, "p1", "p2", Date.now());
  assert.equal(started.ok, true);

  const challenge = room.activeChallenges.get("p1");
  const result = submitAnswer(room, "p1", challenge.answer, Date.now());
  assert.equal(result.ok, true);
  assert.equal(result.resolved, true);

  assert.equal(result.result.value, 12);
  assert.equal(room.players.get("p1").points, 112);
  assert.equal(room.players.get("p2").points, 48);
});

test("falha aplica custo sem zerar atacante por penalidade", () => {
  const room = setupRoom();
  room.players.get("p1").points = 3;

  const started = startInvasion(room, "p1", "p2", Date.now());
  assert.equal(started.ok, true);

  let response;
  response = submitAnswer(room, "p1", "ERRADO", Date.now());
  assert.equal(response.resolved, false);
  response = submitAnswer(room, "p1", "ERRADO", Date.now());
  assert.equal(response.resolved, false);
  response = submitAnswer(room, "p1", "ERRADO", Date.now());
  assert.equal(response.resolved, true);

  assert.equal(response.result.value, 2);
  assert.equal(room.players.get("p1").points, 1);
  assert.equal(room.players.get("p2").points, 102);
});

test("sair da casa resolve como falha", () => {
  const room = setupRoom();

  const started = startInvasion(room, "p1", "p2", Date.now());
  assert.equal(started.ok, true);

  const response = quitChallenge(room, "p1", Date.now());
  assert.equal(response.ok, true);
  assert.equal(response.resolved, true);
  assert.equal(response.result.success, false);
});

test("host pode finalizar partida antecipadamente", () => {
  const room = setupRoom();

  const result = finishGameByHost(room, "p1");
  assert.equal(result.ok, true);
  assert.equal(result.finished, true);
  assert.equal(room.status, "finished");
});

test("encerra quando alguém bate meta", () => {
  const room = setupRoom();
  room.players.get("p1").points = room.settings.victoryGoal;

  const result = evaluateGameOver(room);
  assert.equal(result.finished, true);
  assert.equal(result.winnerId, "p1");
});
