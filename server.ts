import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { Room, Player, Challenge, GameMode, GameUpdate } from "./src/types";
import crypto from "crypto";

const PORT = 3000;

const WORDS_BANK = [
  "ABACAXI", "BORBOLETA", "CACHORRO", "DIAMANTE", "ELEFANTE", "FOGUETE", "GIRASSOL", "HIPOPOTAMO",
  "IGREJA", "JACARE", "KARAOKE", "LIMONADA", "MELANCIA", "NAVIO", "ORQUESTRA", "PANTUFA",
  "QUEIJO", "RELAMPAGO", "SAPATO", "TELEFONE", "URSO", "VASSOURA", "XADREZ", "ZEBRA",
  "AVIAO", "BICICLETA", "COMPUTADOR", "DINOSSAURO", "ESCORREGA", "FLORESTA", "GUITARRA", "HELICOPTERO",
  "ILHA", "JANELA", "KOALA", "LIVRO", "MONTANHA", "NUVEM", "OCULOS", "PIANO",
  "QUADRO", "ROBO", "SORVETE", "TREM", "UNIVERSO", "VIOLAO", "WIND_SURF", "XILOFONE", "YOGA", "ZOOLOOGICO"
];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getIpHash(req: any) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  return crypto.createHash('md5').update(ip as string).digest('hex');
}

function normalize(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function createChallenge(room: Room, attackerId: string, targetId: string): Challenge {
  const isMath = room.mode === 'PALAVRAS_CONTAS' && Math.random() > 0.5;
  
  if (isMath) {
    const a = Math.floor(Math.random() * 90) + 10;
    const b = Math.floor(Math.random() * 90) + 10;
    const op = Math.random() > 0.5 ? '+' : '-';
    const question = `${a} ${op} ${b}`;
    const answer = op === '+' ? (a + b).toString() : (a - b).toString();
    return {
      id: Math.random().toString(36).substring(7),
      type: 'MATH',
      question,
      answer,
      attackerId,
      targetId
    };
  } else {
    if (room.deck.length === 0) {
      room.deck = [...WORDS_BANK].sort(() => Math.random() - 0.5);
      room.usedDeck = [];
    }
    const word = room.deck.pop()!;
    room.usedDeck.push(word);
    return {
      id: Math.random().toString(36).substring(7),
      type: 'WORD',
      question: word,
      answer: word,
      attackerId,
      targetId
    };
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const rooms: Record<string, Room> = {};
  const playerToRoom: Record<string, string> = {};
  const activeChallenges: Record<string, Challenge> = {};

  io.on("connection", (socket) => {
    const ipHash = getIpHash(socket.handshake);
    console.log(`New connection: ${socket.id} from ${ipHash}`);

    socket.on("discover_rooms", () => {
      const activeRooms = Object.values(rooms)
        .filter(r => r.ipHash === ipHash && r.status === 'LOBBY')
        .map(r => ({
          code: r.code,
          hostName: (Object.values(r.players) as Player[]).find(p => p.isHost)?.name || "Desconhecido"
        }));
      socket.emit("discovery_rooms", activeRooms);
    });

    socket.on("create_room", ({ playerName, mode }) => {
      try {
        if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
          return socket.emit("error", "Nome do jogador é obrigatório.");
        }
        
        const code = generateRoomCode();
        const name = normalize(playerName);
        const reconnectKey = crypto.randomBytes(16).toString('hex');
        
        const player: Player = {
          id: socket.id,
          name,
          points: 100,
          status: 'WAITING',
          reconnectKey,
          isHost: true
        };

        rooms[code] = {
          code,
          mode,
          players: { [socket.id]: player },
          status: 'LOBBY',
          updates: [],
          deck: [...WORDS_BANK].sort(() => Math.random() - 0.5),
          usedDeck: [],
          finishCount: 0,
          ipHash
        };

        playerToRoom[socket.id] = code;
        socket.join(code);
        socket.emit("room_state", rooms[code]);
      } catch (err) {
        socket.emit("error", "Erro interno ao criar sala.");
      }
    });

    socket.on("join_room", ({ playerName, roomCode, reconnectKey }) => {
      try {
        const code = normalize(roomCode || "");
        const name = normalize(playerName || "");
        const room = rooms[code];

        if (!room) {
          return socket.emit("error", "Sala não encontrada.");
        }

        if (reconnectKey) {
          const existingPlayer = (Object.values(room.players) as Player[]).find(p => p.reconnectKey === reconnectKey);
          if (existingPlayer) {
            const oldId = existingPlayer.id;
            delete room.players[oldId];
            existingPlayer.id = socket.id;
            room.players[socket.id] = existingPlayer;
            playerToRoom[socket.id] = code;
            socket.join(code);
            return socket.emit("room_state", room);
          }
        }

        if (room.status !== 'LOBBY') {
          return socket.emit("error", "Partida já em andamento.");
        }

        const newReconnectKey = crypto.randomBytes(16).toString('hex');
        const player: Player = {
          id: socket.id,
          name,
          points: 100,
          status: 'WAITING',
          reconnectKey: newReconnectKey,
          isHost: false
        };

        room.players[socket.id] = player;
        playerToRoom[socket.id] = code;
        socket.join(code);
        io.to(code).emit("room_state", room);
      } catch (err) {
        socket.emit("error", "Erro interno ao entrar na sala.");
      }
    });

    socket.on("start_game", (code) => {
      const room = rooms[code];
      if (room && (room.players[socket.id] as Player)?.isHost) {
        room.status = 'ACTIVE';
        (Object.values(room.players) as Player[]).forEach(p => p.status = 'PLAYING');
        io.to(code).emit("room_state", room);
      }
    });

    socket.on("attack_player", ({ roomCode, targetId }) => {
      const room = rooms[roomCode];
      if (!room || room.status !== 'ACTIVE') return;
      const attacker = room.players[socket.id] as Player;
      const target = room.players[targetId] as Player;
      if (!attacker || !target || attacker.id === target.id) return;
      
      const challenge = createChallenge(room, attacker.id, target.id);
      activeChallenges[challenge.id] = challenge;
      socket.emit("challenge_start", challenge);
    });

    socket.on("submit_answer", ({ roomCode, challengeId, answer }) => {
      const room = rooms[roomCode];
      const challenge = activeChallenges[challengeId];
      if (!room || !challenge) return;

      const attacker = room.players[challenge.attackerId] as Player;
      const target = room.players[challenge.targetId] as Player;

      if (!attacker || !target) return;

      const isCorrect = normalize(answer) === normalize(challenge.answer);
      
      if (isCorrect) {
        const pointsToSteal = Math.min(10, target.points);
        target.points -= pointsToSteal;
        attacker.points += pointsToSteal;

        const update: GameUpdate = {
          id: Math.random().toString(36).substring(7),
          message: `${attacker.name} invadiu a casa de ${target.name} e saqueou ${pointsToSteal} pontos!`,
          timestamp: Date.now()
        };
        room.updates.unshift(update);
        if (room.updates.length > 20) room.updates.pop();

        if (target.points <= 0) {
          target.status = 'ELIMINATED';
          target.finishPosition = (Object.values(room.players) as Player[]).length - room.finishCount;
          room.finishCount++;
        }
        if (attacker.points >= 200) {
          attacker.status = 'FINISHED';
          room.finishCount++;
          attacker.finishPosition = room.finishCount;
        }

        socket.emit("challenge_result", { success: true, message: "Sucesso!", pointsGained: pointsToSteal });
      } else {
        socket.emit("challenge_result", { success: false, message: "Resposta incorreta!", pointsGained: 0 });
      }

      delete activeChallenges[challengeId];
      
      const activePlayers = (Object.values(room.players) as Player[]).filter(p => p.status === 'PLAYING');
      if (activePlayers.length <= 1 && (Object.values(room.players) as Player[]).length > 1) {
        room.status = 'FINISHED';
      }

      io.to(roomCode).emit("room_state", room);
    });

    socket.on("quit_challenge", ({ roomCode, challengeId }) => {
      const room = rooms[roomCode];
      const challenge = activeChallenges[challengeId];
      if (!room || !challenge) return;

      const attacker = room.players[challenge.attackerId] as Player;
      if (attacker) {
        const penalty = 5;
        attacker.points = Math.max(0, attacker.points - penalty);
        
        const update: GameUpdate = {
          id: Math.random().toString(36).substring(7),
          message: `${attacker.name} desistiu da invasão e perdeu ${penalty} pontos.`,
          timestamp: Date.now()
        };
        room.updates.unshift(update);
        
        if (attacker.points <= 0) {
          attacker.status = 'ELIMINATED';
          attacker.finishPosition = (Object.values(room.players) as Player[]).length - room.finishCount;
          room.finishCount++;
        }
      }

      delete activeChallenges[challengeId];
      io.to(roomCode).emit("room_state", room);
    });

    socket.on("restart_game", (code) => {
      const room = rooms[code];
      if (room && (room.players[socket.id] as Player)?.isHost) {
        room.status = 'LOBBY';
        room.updates = [];
        room.finishCount = 0;
        (Object.values(room.players) as Player[]).forEach(p => {
          p.points = 100;
          p.status = 'WAITING';
          delete p.finishPosition;
        });
        io.to(code).emit("room_state", room);
      }
    });

    socket.on("finish_game", (code) => {
      const room = rooms[code];
      if (room && (room.players[socket.id] as Player)?.isHost) {
        room.status = 'FINISHED';
        io.to(code).emit("room_state", room);
      }
    });

    socket.on("heartbeat", () => {});

    socket.on("disconnect", () => {
      const code = playerToRoom[socket.id];
      delete playerToRoom[socket.id];
    });
  });

  app.get("/healthz", (req, res) => {
    res.send("ok");
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();