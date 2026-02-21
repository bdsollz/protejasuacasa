import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import {
  createPlayer,
  createRoom,
  evaluateGameOver,
  finishGameByHost,
  normalizeUpper,
  quitChallenge,
  roomSnapshot,
  sanitizeSettings,
  startGame,
  startInvasion,
  submitAnswer
} from "./gameEngine.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    methods: ["GET", "POST"]
  }
});
const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

app.use(express.static("public"));

const rooms = new Map();
const socketIndex = new Map();

function getRoom(code) {
  return rooms.get(normalizeUpper(code));
}

function emitRoom(room) {
  io.to(room.code).emit("room:update", roomSnapshot(room));
}

function removePlayer(socketId) {
  const info = socketIndex.get(socketId);
  if (!info) {
    return;
  }

  const room = getRoom(info.roomCode);
  if (!room) {
    socketIndex.delete(socketId);
    return;
  }

  room.players.delete(info.playerId);
  room.activeChallenges.delete(info.playerId);
  socketIndex.delete(socketId);

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === info.playerId) {
    room.hostId = room.players.values().next().value.id;
  }

  emitRoom(room);
}

function checkGameEnd(room) {
  const result = evaluateGameOver(room);
  if (!result.finished) {
    return false;
  }
  emitRoom(room);
  io.to(room.code).emit("game:ended", result);
  return true;
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }) => {
    const playerName = normalizeUpper(name);
    if (!playerName) {
      socket.emit("action:error", "Nome é obrigatório");
      return;
    }

    const roomCode = genCode();
    const player = createPlayer({ id: socket.id, name: playerName, socketId: socket.id, isHost: true });
    const room = createRoom(roomCode, player);

    rooms.set(roomCode, room);
    socketIndex.set(socket.id, { roomCode, playerId: player.id });
    socket.join(roomCode);

    socket.emit("room:joined", { playerId: player.id, room: roomSnapshot(room) });
    emitRoom(room);
  });

  socket.on("room:join", ({ code, name }) => {
    const room = getRoom(code);
    const playerName = normalizeUpper(name);

    if (!room) {
      socket.emit("action:error", "Sala não encontrada");
      return;
    }
    if (!playerName) {
      socket.emit("action:error", "Nome é obrigatório");
      return;
    }
    if (room.status !== "lobby") {
      socket.emit("action:error", "Partida já iniciada");
      return;
    }

    const player = createPlayer({ id: socket.id, name: playerName, socketId: socket.id });
    room.players.set(player.id, player);

    socketIndex.set(socket.id, { roomCode: room.code, playerId: player.id });
    socket.join(room.code);

    socket.emit("room:joined", { playerId: player.id, room: roomSnapshot(room) });
    emitRoom(room);
  });

  socket.on("room:update-settings", (settings) => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }
    const room = getRoom(info.roomCode);
    if (!room || room.hostId !== info.playerId || room.status !== "lobby") {
      return;
    }

    room.settings = sanitizeSettings({ ...room.settings, ...settings });
    emitRoom(room);
  });

  socket.on("game:start", () => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }
    const room = getRoom(info.roomCode);
    if (!room) {
      return;
    }
    if (room.hostId !== info.playerId) {
      socket.emit("action:error", "Só o host pode iniciar");
      return;
    }
    if (room.players.size < 2) {
      socket.emit("action:error", "Mínimo de 2 jogadores");
      return;
    }

    startGame(room);
    emitRoom(room);
  });

  socket.on("game:finish", () => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }
    const room = getRoom(info.roomCode);
    if (!room) {
      return;
    }

    const result = finishGameByHost(room, info.playerId);
    if (!result.ok) {
      socket.emit("action:error", result.reason);
      return;
    }

    emitRoom(room);
    io.to(room.code).emit("game:ended", result);
  });

  socket.on("game:choose-target", ({ targetId }) => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }
    const room = getRoom(info.roomCode);
    if (!room) {
      return;
    }

    const started = startInvasion(room, info.playerId, targetId, Date.now());
    if (!started.ok) {
      socket.emit("action:error", started.reason);
      return;
    }

    socket.emit("challenge:start", started.challenge);
    emitRoom(room);
  });

  socket.on("challenge:answer", ({ answer }) => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }
    const room = getRoom(info.roomCode);
    if (!room) {
      return;
    }

    const response = submitAnswer(room, info.playerId, answer, Date.now());
    if (!response.ok) {
      socket.emit("action:error", response.reason);
      return;
    }

    if (!response.resolved) {
      socket.emit("challenge:attempt", { attemptsLeft: response.attemptsLeft });
      return;
    }

    socket.emit("challenge:resolved", response.result);
    io.to(room.code).emit("attack:result", response.result);
    emitRoom(room);
    checkGameEnd(room);
  });

  socket.on("challenge:quit", () => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }
    const room = getRoom(info.roomCode);
    if (!room) {
      return;
    }

    const response = quitChallenge(room, info.playerId, Date.now());
    if (!response.ok) {
      socket.emit("action:error", response.reason);
      return;
    }

    socket.emit("challenge:resolved", response.result);
    io.to(room.code).emit("attack:result", response.result);
    emitRoom(room);
    checkGameEnd(room);
  });

  socket.on("disconnect", () => {
    removePlayer(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor em http://localhost:${PORT}`);
});
