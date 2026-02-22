import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { GameEngine } from "./gameEngine.js";

const app = express();
const httpServer = createServer(app);
const SOCKET_PING_INTERVAL = Number(process.env.SOCKET_PING_INTERVAL || 25000);
const SOCKET_PING_TIMEOUT = Number(process.env.SOCKET_PING_TIMEOUT || 60000);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    methods: ["GET", "POST"]
  },
  pingInterval: SOCKET_PING_INTERVAL,
  pingTimeout: SOCKET_PING_TIMEOUT
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
const engine = new GameEngine();
const socketIndex = new Map();

app.use(express.static("public"));
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

function getNetworkKey(socket) {
  const xff = socket.handshake.headers["x-forwarded-for"];
  const cf = socket.handshake.headers["cf-connecting-ip"];
  const raw =
    (typeof xff === "string" && xff.split(",")[0]) ||
    (typeof cf === "string" && cf) ||
    socket.handshake.address ||
    "";

  const ip = String(raw).trim().replace("::ffff:", "");
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : ip;
  }

  return ip.split(":").slice(0, 4).join(":");
}

function emitRoom(room) {
  io.to(room.code).emit("roomUpdate", engine.serializeRoom(room));
}

function emitNearby(targetSocket = null) {
  const listFor = (socket) => {
    const net = getNetworkKey(socket);
    return [...engine.rooms.values()]
      .filter((room) => room.status === "playing")
      .filter((room) => [...room.players.values()].some((player) => player.networkKey === net))
      .map((room) => ({
        code: room.code,
        mode: room.mode,
        players: room.players.size,
        connected: [...room.players.values()].filter((p) => p.connected).length
      }));
  };

  if (targetSocket) {
    targetSocket.emit("roomsNearby", listFor(targetSocket));
    return;
  }

  for (const socket of io.sockets.sockets.values()) {
    socket.emit("roomsNearby", listFor(socket));
  }
}

function emitTransitions(room, transitions = []) {
  for (const transition of transitions) {
    const player = room.players.get(transition.playerId);
    if (!player?.socketId) continue;

    io.to(player.socketId).emit("playerState", {
      ...transition,
      ranking: engine.buildRanking(room),
      losses: engine.buildLossReport(room, player.id),
      attackRanking: engine.buildAttackRanking(room)
    });
  }
}

function getActor(socket, room) {
  const info = socketIndex.get(socket.id);
  if (!info || !room || info.roomCode !== room.code) return null;
  return room.players.get(info.playerId) || null;
}

io.on("connection", (socket) => {
  emitNearby(socket);

  socket.on("keepalive:ping", () => {
    socket.emit("keepalive:pong", { ts: Date.now() });
  });

  socket.on("findRooms", () => {
    emitNearby(socket);
  });

  socket.on("createRoom", ({ playerName } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const cleanName = String(playerName || "").toUpperCase().replace(/\s+/g, "").trim();
    if (!cleanName) {
      socket.emit("actionError", "Nome é obrigatório.");
      reply({ ok: false, error: "Nome é obrigatório." });
      return;
    }

    const roomCode = genCode();
    const room = engine.createRoom(roomCode, getNetworkKey(socket));
    const host = engine.addPlayer(room, cleanName, socket.id, getNetworkKey(socket), true);

    socket.join(room.code);
    socketIndex.set(socket.id, { roomCode: room.code, playerId: host.id });

    socket.emit("joined", {
      roomCode: room.code,
      playerId: host.id,
      reconnectKey: host.reconnectKey
    });
    reply({
      ok: true,
      roomCode: room.code,
      playerId: host.id
    });

    emitRoom(room);
    emitNearby();
  });

  socket.on("joinRoom", ({ roomCode, playerName } = {}) => {
    const code = String(roomCode || "").toUpperCase().replace(/\s+/g, "").trim();
    const cleanName = String(playerName || "").toUpperCase().replace(/\s+/g, "").trim();

    if (!code || !cleanName) {
      socket.emit("actionError", "Informe nome e código da sala.");
      return;
    }

    const room = engine.getRoom(code);
    if (!room) {
      socket.emit("actionError", "Sala não encontrada.");
      return;
    }

    const player = engine.addPlayer(room, cleanName, socket.id, getNetworkKey(socket));

    socket.join(room.code);
    socketIndex.set(socket.id, { roomCode: room.code, playerId: player.id });

    socket.emit("joined", {
      roomCode: room.code,
      playerId: player.id,
      reconnectKey: player.reconnectKey
    });

    emitRoom(room);
    emitNearby();
  });

  socket.on("reconnectRoom", ({ roomCode, playerId, reconnectKey } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) {
      socket.emit("reconnectFailed");
      return;
    }

    const player = room.players.get(String(playerId || ""));
    if (!player || player.reconnectKey !== String(reconnectKey || "")) {
      socket.emit("reconnectFailed");
      return;
    }

    player.socketId = socket.id;
    player.connected = true;
    player.networkKey = getNetworkKey(socket);

    socket.join(room.code);
    socketIndex.set(socket.id, { roomCode: room.code, playerId: player.id });

    socket.emit("joined", {
      roomCode: room.code,
      playerId: player.id,
      reconnectKey: player.reconnectKey
    });

    emitRoom(room);
    emitNearby();
  });

  socket.on("startGame", ({ roomCode, mode } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    const actor = getActor(socket, room);
    if (!actor?.isHost) {
      socket.emit("actionError", "Só o host pode iniciar.");
      return;
    }

    engine.startGame(room, mode);
    emitRoom(room);
    io.to(room.code).emit("gameStarted");
    emitNearby();
  });

  socket.on("finishGame", ({ roomCode } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    const actor = getActor(socket, room);
    if (!actor?.isHost) {
      socket.emit("actionError", "Só o host pode finalizar.");
      return;
    }

    engine.finishGame(room);
    emitRoom(room);
    io.to(room.code).emit("gameFinished", engine.serializeRoom(room));
    emitNearby();
  });

  socket.on("attack", ({ roomCode, attackerId, targetId } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    const out = engine.processAttack(room, attackerId, targetId);
    if (out?.error) {
      socket.emit("actionError", out.error);
      return;
    }

    socket.emit("challenge", out.challenge);
  });

  socket.on("submitAnswer", ({ roomCode, playerId, answer } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    const result = engine.resolveChallenge(room, playerId, answer);
    if (!result) return;

    socket.emit("challengeResult", result);
    emitTransitions(room, result.transitions);
    emitRoom(room);

    if (engine.maybeFinish(room)) {
      emitRoom(room);
      io.to(room.code).emit("gameFinished", engine.serializeRoom(room));
      emitNearby();
    }
  });

  socket.on("quitChallenge", ({ roomCode, playerId } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    const result = engine.quitChallenge(room, playerId);
    if (!result) return;

    socket.emit("challengeResult", result);
    emitTransitions(room, result.transitions);
    emitRoom(room);

    if (engine.maybeFinish(room)) {
      emitRoom(room);
      io.to(room.code).emit("gameFinished", engine.serializeRoom(room));
      emitNearby();
    }
  });

  socket.on("getMyReport", ({ roomCode, playerId } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    socket.emit("myReport", {
      losses: engine.buildLossReport(room, playerId),
      attackRanking: engine.buildAttackRanking(room),
      ranking: engine.buildRanking(room)
    });
  });

  socket.on("restartGame", ({ roomCode } = {}) => {
    const room = engine.getRoom(roomCode);
    if (!room) return;

    const actor = getActor(socket, room);
    if (!actor?.isHost) {
      socket.emit("actionError", "Só o host pode reiniciar.");
      return;
    }

    engine.restartToLobby(room);
    emitRoom(room);
    io.to(room.code).emit("gameReset");
    emitNearby();
  });

  socket.on("disconnect", () => {
    const info = socketIndex.get(socket.id);
    socketIndex.delete(socket.id);
    if (!info) return;

    const room = engine.getRoom(info.roomCode);
    if (!room) return;

    const player = room.players.get(info.playerId);
    if (!player) return;

    player.connected = false;
    player.socketId = null;
    player.currentChallenge = null;

    emitRoom(room);
    emitNearby();
  });
});

const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, () => {
  console.log(`Servidor online em http://localhost:${PORT}`);
});
