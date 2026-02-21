import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import {
  createPlayer,
  createRoom,
  finalizeExecution,
  finishGameByHost,
  planInvasion,
  quitChallenge,
  resolveRoundEnd,
  roomSnapshot,
  sanitizeSettings,
  startExecution,
  startGame,
  startPlanning,
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
const timers = new Map();

function getRoom(code) {
  return rooms.get(String(code || "").trim().toUpperCase());
}

function emitRoom(room) {
  io.to(room.code).emit("room:update", roomSnapshot(room));
}

function clearRoomTimers(code) {
  const current = timers.get(code);
  if (!current) {
    return;
  }
  clearTimeout(current.phaseTimeout);
  clearInterval(current.tickInterval);
  timers.delete(code);
}

function phaseTick(room) {
  io.to(room.code).emit("phase:update", {
    phase: room.phase,
    round: room.round,
    phaseEndsAt: room.phaseEndsAt
  });
}

function schedulePlanning(room) {
  clearRoomTimers(room.code);
  startPlanning(room, Date.now(), room.settings.planningSeconds * 1000);
  emitRoom(room);
  phaseTick(room);

  const tickInterval = setInterval(() => phaseTick(room), 1000);
  const phaseTimeout = setTimeout(() => {
    scheduleExecution(room);
  }, room.settings.planningSeconds * 1000);

  timers.set(room.code, { tickInterval, phaseTimeout });
}

function scheduleExecution(room) {
  clearRoomTimers(room.code);
  startExecution(room, Date.now(), room.settings.challengeSeconds * 1000);

  for (const [attackerId, challenge] of room.activeChallenges.entries()) {
    const attacker = room.players.get(attackerId);
    if (!attacker) {
      continue;
    }
    io.to(attacker.socketId).emit("challenge:start", {
      targetId: challenge.targetId,
      masked: challenge.masked,
      hint: challenge.hint,
      attemptsLeft: challenge.attemptsLeft,
      deadline: challenge.deadline
    });
  }

  emitRoom(room);
  phaseTick(room);

  const tickInterval = setInterval(() => phaseTick(room), 1000);
  const phaseTimeout = setTimeout(() => {
    finalizeAndShowResult(room);
  }, room.settings.challengeSeconds * 1000);

  timers.set(room.code, { tickInterval, phaseTimeout });
}

function finalizeAndShowResult(room) {
  clearRoomTimers(room.code);
  finalizeExecution(room, Date.now());
  room.phase = "result";
  room.phaseEndsAt = Date.now() + room.settings.resultSeconds * 1000;
  emitRoom(room);

  for (const player of room.players.values()) {
    io.to(player.socketId).emit("round:result", player.result);
  }

  const tickInterval = setInterval(() => phaseTick(room), 1000);
  const phaseTimeout = setTimeout(() => {
    const result = resolveRoundEnd(room);
    emitRoom(room);

    if (result.finished) {
      clearRoomTimers(room.code);
      io.to(room.code).emit("game:ended", result);
      return;
    }

    schedulePlanning(room);
  }, room.settings.resultSeconds * 1000);

  timers.set(room.code, { tickInterval, phaseTimeout });
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
  socketIndex.delete(socketId);

  if (room.players.size === 0) {
    clearRoomTimers(room.code);
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === info.playerId) {
    room.hostId = room.players.values().next().value.id;
  }

  emitRoom(room);
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }) => {
    const playerName = String(name || "").trim();
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
    const playerName = String(name || "").trim();

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
    schedulePlanning(room);
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

    const result = planInvasion(room, info.playerId, targetId);
    if (!result.ok) {
      socket.emit("action:error", result.reason);
      return;
    }

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

    clearRoomTimers(room.code);
    emitRoom(room);
    io.to(room.code).emit("game:ended", result);
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

    const response = quitChallenge(room, info.playerId);
    if (!response.ok) {
      socket.emit("action:error", response.reason);
      return;
    }

    socket.emit("challenge:resolved", response.result);
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
