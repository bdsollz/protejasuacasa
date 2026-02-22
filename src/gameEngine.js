import { WORDS, generateMath } from './challenges.js';
import { nanoid } from 'nanoid';

export class GameEngine {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomCode, ip) {
    const room = {
      code: roomCode.toUpperCase(),
      ip: ip,
      status: 'waiting', 
      players: new Map(),
      mode: 'Palavras',
      deck: [...WORDS],
      meta: 200,
      history: []
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode?.toUpperCase());
  }

  addPlayer(room, playerName, socketId) {
    const playerId = nanoid(5).toUpperCase();
    const player = {
      id: playerId,
      name: playerName.toUpperCase().replace(/\s/g, ''),
      socketId: socketId,
      points: 50,
      status: 'active',
      reconnectKey: nanoid(10),
      currentChallenge: null,
      position: null
    };
    room.players.set(playerId, player);
    return player;
  }

  generateChallenge(room) {
    if (room.mode === 'Palavras e Contas' && Math.random() > 0.5) {
      return generateMath();
    }
    if (room.deck.length === 0) room.deck = [...WORDS];
    const index = Math.floor(Math.random() * room.deck.length);
    const word = room.deck.splice(index, 1)[0];
    return { text: word, answer: word };
  }

  processAttack(room, attackerId, targetId) {
    const attacker = room.players.get(attackerId);
    if (!attacker || attacker.status !== 'active') return null;
    
    attacker.currentChallenge = {
      targetId,
      challenge: this.generateChallenge(room)
    };
    return attacker.currentChallenge.challenge.text;
  }

  resolveChallenge(room, attackerId, answer) {
    const attacker = room.players.get(attackerId);
    if (!attacker || !attacker.currentChallenge) return null;

    const { targetId, challenge } = attacker.currentChallenge;
    const target = room.players.get(targetId);

    const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    
    if (normalize(answer) === normalize(challenge.answer)) {
      const stealAmount = Math.min(target.points, 10);
      target.points -= stealAmount;
      attacker.points += stealAmount;
      
      room.history.unshift(`${attacker.name} pegou ${stealAmount} pontos de ${target.name}`);
      this.checkStatus(room, attacker);
      this.checkStatus(room, target);
      attacker.currentChallenge = null;
      return { success: true, amount: stealAmount };
    }
    return { success: false };
  }

  checkStatus(room, player) {
    if (player.points >= room.meta && player.status === 'active') {
      player.status = 'finished';
      const finishedCount = Array.from(room.players.values()).filter(p => p.status === 'finished').length;
      player.position = finishedCount;
    } else if (player.points <= 0 && player.status === 'active') {
      player.status = 'eliminated';
      const total = room.players.size;
      const actives = Array.from(room.players.values()).filter(p => p.status === 'active').length;
      player.position = actives + 1;
    }
  }
}