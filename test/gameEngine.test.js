import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayer,
  createRoom,
  startGame,
  startPlanning,
  planInvasion,
  startExecution,
  submitAnswer,
  sanitizeSettings
} from "../src/gameEngine.js";

function setupRoom() {
  const p1 = createPlayer({ id: "p1", name: "A", socketId: "p1", isHost: true });
  const p2 = createPlayer({ id: "p2", name: "B", socketId: "p2" });
  const room = createRoom("ABC123", p1);
  room.players.set(p2.id, p2);
  room.settings = sanitizeSettings({
    initialPoints: 100,
    fixedStealCap: 25,
    percentStealCap: 0.2,
    baseStealValue: 18,
    challengeSeconds: 20,
    maxAttempts: 3,
    failCost: 8
  });
  startGame(room);
  return room;
}

test("roubo respeita teto percentual do alvo", () => {
  const room = setupRoom();
  room.players.get("p2").points = 60;

  startPlanning(room, Date.now(), 5000);
  assert.equal(planInvasion(room, "p1", "p2").ok, true);

  startExecution(room, Date.now(), 20000);
  const challenge = room.activeChallenges.get("p1");

  const result = submitAnswer(room, "p1", challenge.answer, Date.now() + 3000);
  assert.equal(result.ok, true);
  assert.equal(result.resolved, true);

  // 20% de 60 = 12, então esse é o teto real
  assert.equal(result.result.value, 12);
  assert.equal(room.players.get("p1").points, 112);
  assert.equal(room.players.get("p2").points, 48);
});

test("falha aplica custo sem zerar atacante por penalidade", () => {
  const room = setupRoom();
  room.players.get("p1").points = 3;

  startPlanning(room, Date.now(), 5000);
  assert.equal(planInvasion(room, "p1", "p2").ok, true);

  startExecution(room, Date.now(), 20000);

  let response;
  response = submitAnswer(room, "p1", "ERRADO", Date.now() + 1000);
  assert.equal(response.resolved, false);
  response = submitAnswer(room, "p1", "ERRADO", Date.now() + 2000);
  assert.equal(response.resolved, false);
  response = submitAnswer(room, "p1", "ERRADO", Date.now() + 3000);
  assert.equal(response.resolved, true);

  // failCost=8, mas atacante tinha 3 => custo capado para 2 (fica com 1)
  assert.equal(response.result.value, 2);
  assert.equal(room.players.get("p1").points, 1);
  assert.equal(room.players.get("p2").points, 102);
});
