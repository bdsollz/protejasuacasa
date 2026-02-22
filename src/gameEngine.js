import { WORD_BANK, generateMath, maskWord } from "./challenges.js";

function normalizeTextAnswer(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ç/g, "C")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function cloneDeck() {
  return [...WORD_BANK];
}

function ensureDeck(room) {
  if (!room.deck.length) {
    room.deck = cloneDeck();
  }
}

function makeId(size = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export class GameEngine {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomCode, networkKey) {
    const room = {
      code: String(roomCode || "").toUpperCase(),
      status: "waiting",
      mode: "Palavras",
      targetGoal: 200,
      networkKey,
      players: new Map(),
      deck: cloneDeck(),
      history: [],
      finishedOrder: [],
      eliminatedOrder: [],
      createdAt: Date.now()
    };

    this.rooms.set(room.code, room);
    return room;
  }

  getRoom(roomCode) {
    return this.rooms.get(String(roomCode || "").toUpperCase());
  }

  addPlayer(room, playerName, socketId, networkKey, isHost = false) {
    const playerId = makeId(8);
    const player = {
      id: playerId,
      name: String(playerName || "").toUpperCase().replace(/\s+/g, ""),
      socketId,
      reconnectKey: `${makeId(12)}${makeId(12)}`,
      networkKey,
      isHost,
      connected: true,
      status: "active",
      points: room.status === "playing" ? 100 : 0,
      position: null,
      currentChallenge: null,
      stolenTotal: 0,
      attacksCount: 0,
      sufferedFrom: {}
    };

    room.players.set(playerId, player);
    return player;
  }

  startGame(room, mode) {
    room.status = "playing";
    room.mode = mode === "Palavras e Contas" ? "Palavras e Contas" : "Palavras";
    room.deck = cloneDeck();
    room.history = [];
    room.finishedOrder = [];
    room.eliminatedOrder = [];

    for (const player of room.players.values()) {
      player.status = "active";
      player.points = 100;
      player.position = null;
      player.currentChallenge = null;
      player.stolenTotal = 0;
      player.attacksCount = 0;
      player.sufferedFrom = {};
    }
  }

  restartToLobby(room) {
    room.status = "waiting";
    room.deck = cloneDeck();
    room.history = [];
    room.finishedOrder = [];
    room.eliminatedOrder = [];

    for (const player of room.players.values()) {
      player.status = "active";
      player.points = 0;
      player.position = null;
      player.currentChallenge = null;
      player.stolenTotal = 0;
      player.attacksCount = 0;
      player.sufferedFrom = {};
    }
  }

  finishGame(room) {
    if (room.status !== "playing") return;

    const active = [...room.players.values()]
      .filter((p) => p.status === "active")
      .sort((a, b) => b.points - a.points);

    for (const player of active) {
      player.status = "finished";
      room.finishedOrder.push(player.id);
    }

    const ranking = this.buildRanking(room);
    for (const player of room.players.values()) {
      const row = ranking.find((item) => item.id === player.id);
      player.position = row?.position || null;
    }

    room.status = "finished";
  }

  generateChallenge(room) {
    if (room.mode === "Palavras e Contas" && Math.random() >= 0.5) {
      return generateMath();
    }

    ensureDeck(room);
    const idx = Math.floor(Math.random() * room.deck.length);
    const entry = room.deck.splice(idx, 1)[0];

    return {
      answerType: "text",
      text: maskWord(entry.word),
      answer: entry.word,
      hint: `Dica: ${entry.hint}`
    };
  }

  processAttack(room, attackerId, targetId) {
    const attacker = room.players.get(String(attackerId || ""));
    const target = room.players.get(String(targetId || ""));

    if (!attacker || !target) return { error: "Jogador inválido" };
    if (room.status !== "playing") return { error: "Partida não iniciada" };
    if (attacker.status !== "active") return { error: "Você não está ativo" };
    if (target.status !== "active") return { error: "Alvo indisponível" };
    if (attacker.id === target.id) return { error: "Não pode pegar pontos da sua própria casa" };
    if (attacker.currentChallenge) return { error: "Finalize seu desafio atual" };

    const challenge = this.generateChallenge(room);
    attacker.currentChallenge = {
      targetId: target.id,
      challenge,
      createdAt: Date.now()
    };

    return {
      challenge: {
        targetId: target.id,
        targetName: target.name,
        text: challenge.text,
        hint: challenge.hint,
        answerType: challenge.answerType
      }
    };
  }

  resolveChallenge(room, attackerId, answer) {
    const attacker = room.players.get(String(attackerId || ""));
    if (!attacker?.currentChallenge) return null;

    const { targetId, challenge } = attacker.currentChallenge;
    const target = room.players.get(targetId);
    if (!target) return null;

    const isCorrect = challenge.answerType === "number"
      ? String(answer || "").trim() === String(challenge.answer || "").trim()
      : normalizeTextAnswer(answer) === normalizeTextAnswer(challenge.answer);
    if (!isCorrect) {
      return {
        success: false,
        message: "Resposta incorreta. Tente outra casa.",
        ranking: this.buildRanking(room)
      };
    }

    const amount = Math.min(10, Math.max(0, target.points));
    target.points -= amount;
    attacker.points += amount;
    attacker.stolenTotal += amount;
    attacker.attacksCount += 1;
    target.sufferedFrom[attacker.id] = Number(target.sufferedFrom[attacker.id] || 0) + amount;

    room.history.unshift(`${attacker.name} pegou ${amount} pontos de ${target.name}`);
    room.history = room.history.slice(0, 30);

    attacker.currentChallenge = null;

    const transitions = [];
    this.checkStatus(room, attacker, transitions);
    this.checkStatus(room, target, transitions);

    return {
      success: true,
      amount,
      message: `Você pegou +${amount} pontos de ${target.name}`,
      transitions,
      ranking: this.buildRanking(room)
    };
  }

  quitChallenge(room, playerId) {
    const player = room.players.get(String(playerId || ""));
    if (!player?.currentChallenge) return null;

    const target = room.players.get(player.currentChallenge.targetId);
    const loss = Math.min(5, Math.max(0, player.points));

    player.points -= loss;
    if (target) {
      target.points += loss;
      target.sufferedFrom[player.id] = Number(target.sufferedFrom[player.id] || 0) + loss;
    }

    room.history.unshift(`${player.name} saiu da casa e perdeu ${loss} ponto(s)`);
    room.history = room.history.slice(0, 30);
    player.currentChallenge = null;

    const transitions = [];
    this.checkStatus(room, player, transitions);

    return {
      success: false,
      byQuit: true,
      amount: loss,
      message: `Você saiu da casa e perdeu ${loss} ponto(s).`,
      transitions,
      ranking: this.buildRanking(room)
    };
  }

  maybeFinish(room) {
    if (room.status !== "playing") return false;

    const activeCount = [...room.players.values()].filter((p) => p.status === "active").length;
    if (activeCount <= 1) {
      const lone = [...room.players.values()].find((p) => p.status === "active");
      if (lone) {
        lone.status = "finished";
        room.finishedOrder.push(lone.id);
      }
      room.status = "finished";
      return true;
    }
    return false;
  }

  checkStatus(room, player, transitions = []) {
    if (!player || player.status !== "active") return;

    if (player.points >= room.targetGoal) {
      player.status = "finished";
      room.finishedOrder.push(player.id);
      const ranking = this.buildRanking(room);
      const row = ranking.find((item) => item.id === player.id);
      player.position = row?.position || null;
      transitions.push({
        type: "finished",
        playerId: player.id,
        position: row?.position || null,
        outOf: row?.outOf || room.players.size
      });
      return;
    }

    if (player.points <= 0) {
      player.points = 0;
      player.status = "eliminated";
      room.eliminatedOrder.push(player.id);
      const ranking = this.buildRanking(room);
      const row = ranking.find((item) => item.id === player.id);
      player.position = row?.position || null;
      transitions.push({
        type: "eliminated",
        playerId: player.id,
        position: row?.position || null,
        outOf: row?.outOf || room.players.size
      });
    }
  }

  buildRanking(room) {
    const finished = room.finishedOrder.map((id) => room.players.get(id)).filter(Boolean);
    const active = [...room.players.values()]
      .filter((p) => p.status === "active")
      .sort((a, b) => b.points - a.points);
    const eliminated = [...room.eliminatedOrder]
      .reverse()
      .map((id) => room.players.get(id))
      .filter(Boolean);

    const ordered = [...finished, ...active, ...eliminated];
    const outOf = ordered.length || room.players.size || 1;

    return ordered.map((player, index) => ({
      position: index + 1,
      outOf,
      id: player.id,
      name: player.name,
      status: player.status,
      points: player.points,
      attacksCount: player.attacksCount,
      stolenTotal: player.stolenTotal
    }));
  }

  buildAttackRanking(room) {
    return [...room.players.values()]
      .map((p) => ({ id: p.id, name: p.name, attacksCount: p.attacksCount, stolenTotal: p.stolenTotal }))
      .sort((a, b) => b.stolenTotal - a.stolenTotal || b.attacksCount - a.attacksCount);
  }

  buildLossReport(room, playerId) {
    const player = room.players.get(String(playerId || ""));
    if (!player) return [];

    return Object.entries(player.sufferedFrom)
      .map(([attackerId, amount]) => {
        const attacker = room.players.get(attackerId);
        return {
          attackerId,
          attackerName: attacker?.name || "DESCONHECIDO",
          amount: Number(amount || 0)
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  serializeRoom(room) {
    return {
      code: room.code,
      status: room.status,
      mode: room.mode,
      targetGoal: room.targetGoal,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        status: p.status,
        points: p.points,
        position: p.position,
        stolenTotal: p.stolenTotal,
        attacksCount: p.attacksCount
      })),
      history: room.history.slice(0, 12),
      ranking: this.buildRanking(room),
      attackRanking: this.buildAttackRanking(room)
    };
  }
}
