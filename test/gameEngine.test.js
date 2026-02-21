import test from "node:test";
import assert from "node:assert/strict";
import {
  addPlayerToRunningGame,
  buildRankingSnapshot,
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
    victoryGoal: 200,
    failCost: 8
  });
  startGame(room);
  return room;
}

test("normaliza textos para maiúsculo", () => {
  assert.equal(normalizeUpper(" abc12 "), "ABC12");
});

test("ataque sempre vale 10 pontos quando alvo tem saldo", () => {
  const room = setupRoom();
  room.players.get("p2").points = 60;

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const challenge = room.activeChallenges.get("p1");
  const response = submitAnswer(room, "p1", challenge.answer, Date.now());
  assert.equal(response.ok, true);
  assert.equal(response.resolved, true);
  assert.equal(response.result.value, 10);
  assert.equal(room.players.get("p1").points, 110);
  assert.equal(room.players.get("p2").points, 50);
});

test("suporta cedilha e acento na resposta", () => {
  const room = setupRoom();
  room.challengeDeck = [{ answer: "AÇÚCAR", hint: "Doce", masked: "A _ U _ A R" }];

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const response = submitAnswer(room, "p1", "ACUCAR", Date.now());
  assert.equal(response.ok, true);
  assert.equal(response.resolved, true);
  assert.equal(response.result.success, true);
});

test("pode atacar mesma pessoa em sequência", () => {
  const room = setupRoom();

  const first = startInvasion(room, "p1", "p2");
  assert.equal(first.ok, true);
  const challenge1 = room.activeChallenges.get("p1");
  submitAnswer(room, "p1", challenge1.answer, Date.now());

  const second = startInvasion(room, "p1", "p2");
  assert.equal(second.ok, true);
});

test("eliminação gera posição de ranking", () => {
  const room = setupRoom();
  room.players.get("p2").points = 1;

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const challenge = room.activeChallenges.get("p1");
  const response = submitAnswer(room, "p1", challenge.answer, Date.now());
  assert.equal(response.resolved, true);

  const transition = response.transitions.find((t) => t.playerId === "p2");
  assert.equal(transition.type, "eliminated");
  assert.equal(typeof transition.position, "number");
});

test("atingir meta marca jogador como finished com posição", () => {
  const room = setupRoom();
  room.players.get("p1").points = 195;

  const started = startInvasion(room, "p1", "p2");
  assert.equal(started.ok, true);

  const challenge = room.activeChallenges.get("p1");
  const response = submitAnswer(room, "p1", challenge.answer, Date.now());
  assert.equal(response.resolved, true);

  const transition = response.transitions.find((t) => t.playerId === "p1");
  assert.equal(transition.type, "finished");
  assert.equal(transition.position, 1);
});

test("ranking dinâmico prioriza ordem de finalização", () => {
  const room = setupRoom();
  const p3 = createPlayer({ id: "p3", name: "c", socketId: "p3" });
  room.players.set("p3", p3);
  addPlayerToRunningGame(room, p3);
  room.players.get("p1").points = 195;
  room.players.get("p2").points = 195;
  room.players.get("p3").points = 195;

  let started = startInvasion(room, "p1", "p2");
  let challenge = room.activeChallenges.get("p1");
  submitAnswer(room, "p1", challenge.answer, Date.now());

  started = startInvasion(room, "p2", "p3");
  assert.equal(started.ok, true);
  challenge = room.activeChallenges.get("p2");
  submitAnswer(room, "p2", challenge.answer, Date.now());

  const ranking = buildRankingSnapshot(room);
  assert.equal(ranking.entries[0].playerId, "p1");
  assert.equal(ranking.entries[1].playerId, "p2");
});

test("game termina quando não há jogadores ativos", () => {
  const room = setupRoom();
  room.players.get("p1").status = "finished";
  room.players.get("p2").status = "eliminated";

  const result = evaluateGameOver(room);
  assert.equal(result.finished, true);
  assert.ok(result.report);
});

test("game termina quando resta apenas um jogador ativo", () => {
  const room = setupRoom();
  room.players.get("p1").status = "alive";
  room.players.get("p2").status = "finished";

  const result = evaluateGameOver(room);
  assert.equal(result.finished, true);
  assert.equal(room.players.get("p1").status, "finished");
});

test("host pode finalizar partida com relatório", () => {
  const room = setupRoom();
  const result = finishGameByHost(room, "p1");

  assert.equal(result.ok, true);
  assert.equal(result.finished, true);
  assert.ok(result.report.placementRanking);
  assert.ok(result.report.attackRanking);
});

test("novo jogador pode entrar no jogo ativo", () => {
  const room = setupRoom();
  const p3 = createPlayer({ id: "p3", name: "c", socketId: "p3" });
  room.players.set("p3", p3);
  addPlayerToRunningGame(room, p3);

  assert.equal(p3.status, "alive");
  assert.equal(p3.points, room.settings.initialPoints);
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
