import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/gameEngine.js";
import { generateMath } from "../src/challenges.js";

test("ataque bem-sucedido sempre transfere 10 pontos (ou menos se alvo não tiver)", () => {
  const engine = new GameEngine();
  const room = engine.createRoom("ABCD12", "10.0.0");
  const attacker = engine.addPlayer(room, "ALFA", "s1", "10.0.0", true);
  const target = engine.addPlayer(room, "BETA", "s2", "10.0.0");
  engine.startGame(room, "Palavras");

  const out = engine.processAttack(room, attacker.id, target.id);
  assert.ok(out.challenge);

  const answer = attacker.currentChallenge.challenge.answer;
  const result = engine.resolveChallenge(room, attacker.id, answer);

  assert.equal(result.success, true);
  assert.equal(attacker.points, 110);
  assert.equal(target.points, 90);
});

test("permite atacar o mesmo alvo repetidas vezes", () => {
  const engine = new GameEngine();
  const room = engine.createRoom("ABCD12", "10.0.0");
  const attacker = engine.addPlayer(room, "ALFA", "s1", "10.0.0", true);
  const target = engine.addPlayer(room, "BETA", "s2", "10.0.0");
  engine.startGame(room, "Palavras");

  for (let i = 0; i < 3; i += 1) {
    const out = engine.processAttack(room, attacker.id, target.id);
    assert.ok(out.challenge);
    const answer = attacker.currentChallenge.challenge.answer;
    const result = engine.resolveChallenge(room, attacker.id, answer);
    assert.equal(result.success, true);
  }

  assert.equal(attacker.points, 130);
  assert.equal(target.points, 70);
});

test("aceita cedilha e acento nas respostas", () => {
  const engine = new GameEngine();
  const room = engine.createRoom("ABCD12", "10.0.0");
  const attacker = engine.addPlayer(room, "ALFA", "s1", "10.0.0", true);
  const target = engine.addPlayer(room, "BETA", "s2", "10.0.0");
  engine.startGame(room, "Palavras");

  attacker.currentChallenge = {
    targetId: target.id,
    challenge: {
      answerType: "text",
      text: "A _ U _ A R",
      answer: "AÇÚCAR",
      hint: "Palavra com cedilha"
    }
  };

  const result = engine.resolveChallenge(room, attacker.id, "ACUCAR");
  assert.equal(result.success, true);
});

test("contas seguem formato XX + XX ou XX - XX", () => {
  for (let i = 0; i < 25; i += 1) {
    const challenge = generateMath();
    assert.match(challenge.text, /^\d{2} [+-] \d{2}$/);
  }
});
