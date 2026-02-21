import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet, nanoid } from "nanoid";
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

const DISCONNECT_GRACE_MS = 5 * 60 * 1000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    methods: ["GET", "POST"]
  }
});

const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const genPlayerId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);
const genReconnectKey = () => nanoid(36);

app.use(express.static("public"));

const rooms = new Map();
const socketIndex = new Map();
const reconnectTimers = new Map();

function getRoom(code) {
  return rooms.get(normalizeUpper(code));
}

function timerKey(roomCode, playerId) {
  return `${roomCode}:${playerId}`;
}

function cancelReconnectTimer(roomCode, playerId) {
  const key = timerKey(roomCode, playerId);
  const timer = reconnectTimers.get(key);
  if (!timer) {
    return;
  }
  clearTimeout(timer);
  reconnectTimers.delete(key);
}

function activeRoomsSnapshot() {
  return [...rooms.values()]
    .filter((room) => room.status === "in_game")
    .map((room) => ({
      code: room.code,
      players: room.players.size,
      connectedPlayers: [...room.players.values()].filter((p) => p.connected).length
    }));
}

function emitActiveRooms(targetSocket = null) {
  const payload = activeRoomsSnapshot();
  if (targetSocket) {
    targetSocket.emit("rooms:active", payload);
    return;
  }
  io.emit("rooms:active", payload);
}

function emitRoom(room) {
  io.to(room.code).emit("room:update", roomSnapshot(room));
  emitActiveRooms();
}

function bindSocketToPlayer(room, player, socket) {
  cancelReconnectTimer(room.code, player.id);
  player.socketId = socket.id;
  player.connected = true;

  socket.join(room.code);
  socketIndex.set(socket.id, { roomCode: room.code, playerId: player.id });
}

function cleanupRoomIfEmpty(room) {
  if (room.players.size > 0) {
    return;
  }
  rooms.delete(room.code);
}

function dropPlayer(room, playerId) {
  room.players.delete(playerId);
  room.activeChallenges.delete(playerId);

  if (room.hostId === playerId && room.players.size > 0) {
    room.hostId = room.players.values().next().value.id;
  }

  cleanupRoomIfEmpty(room);
}

function scheduleDisconnectCleanup(room, playerId) {
  cancelReconnectTimer(room.code, playerId);

  const key = timerKey(room.code, playerId);
  const timer = setTimeout(() => {
    reconnectTimers.delete(key);
    const latestRoom = getRoom(room.code);
    if (!latestRoom) {
      return;
    }
    const player = latestRoom.players.get(playerId);
    if (!player || player.connected) {
      return;
    }

    dropPlayer(latestRoom, playerId);
    if (rooms.has(latestRoom.code)) {
      emitRoom(latestRoom);
    } else {
      emitActiveRooms();
    }
  }, DISCONNECT_GRACE_MS);

  reconnectTimers.set(key, timer);
}

function disconnectSocket(socketId) {
  const info = socketIndex.get(socketId);
  if (!info) {
    return;
  }

  const room = getRoom(info.roomCode);
  socketIndex.delete(socketId);

  if (!room) {
    return;
  }

  const player = room.players.get(info.playerId);
  if (!player) {
    return;
  }

  player.connected = false;
  player.socketId = null;
  room.activeChallenges.delete(player.id);
  scheduleDisconnectCleanup(room, player.id);
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
  emitActiveRooms(socket);

  socket.on("rooms:list", () => {
    emitActiveRooms(socket);
  });

  socket.on("room:create", ({ name }) => {
    const playerName = normalizeUpper(name);
    if (!playerName) {
      socket.emit("action:error", "Nome é obrigatório");
      return;
    }

    const roomCode = genCode();
    const player = createPlayer({ id: genPlayerId(), name: playerName, socketId: socket.id, isHost: true });
    player.reconnectKey = genReconnectKey();

    const room = createRoom(roomCode, player);
    rooms.set(roomCode, room);

    bindSocketToPlayer(room, player, socket);

    socket.emit("room:joined", {
      playerId: player.id,
      reconnectKey: player.reconnectKey,
      room: roomSnapshot(room)
    });

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

    const player = createPlayer({ id: genPlayerId(), name: playerName, socketId: socket.id });
    player.reconnectKey = genReconnectKey();

    room.players.set(player.id, player);
    bindSocketToPlayer(room, player, socket);

    socket.emit("room:joined", {
      playerId: player.id,
      reconnectKey: player.reconnectKey,
      room: roomSnapshot(room)
    });

    emitRoom(room);
  });

  socket.on("room:reconnect", ({ code, playerId, reconnectKey }) => {
    const room = getRoom(code);
    if (!room) {
      socket.emit("room:reconnect-failed");
      return;
    }

    const player = room.players.get(String(playerId || ""));
    if (!player || player.reconnectKey !== String(reconnectKey || "")) {
      socket.emit("room:reconnect-failed");
      return;
    }

    bindSocketToPlayer(room, player, socket);

    socket.emit("room:joined", {
      playerId: player.id,
      reconnectKey: player.reconnectKey,
      room: roomSnapshot(room)
    });

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

  socket.on("room:leave", () => {
    const info = socketIndex.get(socket.id);
    if (!info) {
      return;
    }

    const room = getRoom(info.roomCode);
    socketIndex.delete(socket.id);

    if (!room) {
      return;
    }

    cancelReconnectTimer(room.code, info.playerId);
    dropPlayer(room, info.playerId);

    socket.leave(info.roomCode);

    if (rooms.has(room.code)) {
      emitRoom(room);
    } else {
      emitActiveRooms();
    }
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

    const started = startInvasion(room, info.playerId, String(targetId || ""));
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
      socket.emit("challenge:attempt");
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
    disconnectSocket(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor em http://localhost:${PORT}`);
});
