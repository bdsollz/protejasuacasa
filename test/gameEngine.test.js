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
    failCost: 8
  });
  startGame(room);
  return room;
}

test("normaliza textos para maiúsculo", () => {
  assert.equal(normalizeUpper(" abc12 "), "ABC12");
});

test("roubo respeita limite maximo de 10 por ataque", () => {
  const room = setupRoom();
  room.players.get("p2").points = 60;

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const challenge = room.activeChallenges.get("p1");
  const result = submitAnswer(room, "p1", challenge.answer, Date.now());
  assert.equal(result.ok, true);
  assert.equal(result.resolved, true);

  assert.equal(result.result.value, 10);
  assert.equal(room.players.get("p1").points, 110);
  assert.equal(room.players.get("p2").points, 50);
});

test("erro nao consome tentativas", () => {
  const room = setupRoom();

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const response1 = submitAnswer(room, "p1", "ERRADO", Date.now());
  const response2 = submitAnswer(room, "p1", "ERRADO", Date.now());
  const response3 = submitAnswer(room, "p1", "ERRADO", Date.now());
  assert.equal(response1.resolved, false);
  assert.equal(response2.resolved, false);
  assert.equal(response3.resolved, false);
  assert.equal(room.activeChallenges.has("p1"), true);
});

test("sair da casa resolve como falha", () => {
  const room = setupRoom();

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const response = quitChallenge(room, "p1", Date.now());
  assert.equal(response.ok, true);
  assert.equal(response.resolved, true);
  assert.equal(response.result.success, false);
});

test("pode pegar pontos da mesma casa varias vezes seguidas", () => {
  const room = setupRoom();

  const first = startInvasion(room, "p1", "p2");
  assert.equal(first.ok, true);
  const challenge1 = room.activeChallenges.get("p1");
  const result1 = submitAnswer(room, "p1", challenge1.answer, Date.now());
  assert.equal(result1.resolved, true);

  const second = startInvasion(room, "p1", "p2");
  assert.equal(second.ok, true);
});

test("charadas nao se repetem enquanto o baralho nao acabar", () => {
  const room = setupRoom();
  room.challengeDeck = [
    { answer: "ALFA", hint: "A", masked: "A _ F A" },
    { answer: "BETA", hint: "B", masked: "B _ T A" }
  ];

  const first = startInvasion(room, "p1", "p2");
  assert.equal(first.ok, true);
  const firstAnswer = room.activeChallenges.get("p1").answer;
  submitAnswer(room, "p1", firstAnswer, Date.now());

  const second = startInvasion(room, "p1", "p2");
  assert.equal(second.ok, true);
  const secondAnswer = room.activeChallenges.get("p1").answer;

  assert.notEqual(firstAnswer, secondAnswer);
});

test("host pode finalizar partida com relatorio", () => {
  const room = setupRoom();

  const result = finishGameByHost(room, "p1");
  assert.equal(result.ok, true);
  assert.equal(result.finished, true);
  assert.equal(room.status, "finished");
  assert.ok(Array.isArray(result.report.ranking));
  assert.ok(result.report.personal.p1);
});

test("encerra quando alguem bate meta", () => {
  const room = setupRoom();
  room.players.get("p1").points = room.settings.victoryGoal;

  const result = evaluateGameOver(room);
  assert.equal(result.finished, true);
  assert.equal(result.winnerId, "p1");
  assert.ok(result.report);
});
