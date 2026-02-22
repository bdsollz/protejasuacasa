import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameEngine } from './gameEngine.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const engine = new GameEngine();

app.use(express.static('public'));
app.get('/healthz', (req, res) => res.send('ok'));

io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  socket.on('findRooms', () => {
    const activeRooms = Array.from(engine.rooms.values())
      .filter(r => r.ip === clientIp && r.status === 'waiting')
      .map(r => r.code);
    socket.emit('roomsNearby', activeRooms);
  });

  socket.on('createRoom', () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    engine.createRoom(code, clientIp);
    socket.emit('roomCreated', code);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = engine.getRoom(roomCode);
    if (!room) return socket.emit('error', 'Sala não encontrada');
    
    const player = engine.addPlayer(room, playerName, socket.id);
    socket.join(room.code);
    
    io.to(room.code).emit('roomUpdate', serializeRoom(room));
    socket.emit('joined', { playerId: player.id, reconnectKey: player.reconnectKey });
  });

  socket.on('startGame', ({ roomCode, mode }) => {
    const room = engine.getRoom(roomCode);
    if (room) {
      room.status = 'playing';
      room.mode = mode || 'Palavras';
      io.to(room.code).emit('roomUpdate', serializeRoom(room));
    }
  });

  socket.on('attack', ({ roomCode, attackerId, targetId }) => {
    const room = engine.getRoom(roomCode);
    const challenge = engine.processAttack(room, attackerId, targetId);
    if (challenge) socket.emit('challenge', challenge);
  });

  socket.on('submitAnswer', ({ roomCode, playerId, answer }) => {
    const room = engine.getRoom(roomCode);
    const result = engine.resolveChallenge(room, playerId, answer);
    if (result) {
      io.to(room.code).emit('roomUpdate', serializeRoom(room));
      socket.emit('challengeResult', result);
    }
  });

  socket.on('quitChallenge', ({ roomCode, playerId }) => {
    const room = engine.getRoom(roomCode);
    const player = room?.players.get(playerId);
    if (player && player.currentChallenge) {
      player.points = Math.max(0, player.points - 5);
      player.currentChallenge = null;
      room.history.unshift(`${player.name} desistiu da invasão (-5 pts)`);
      engine.checkStatus(room, player);
      io.to(room.code).emit('roomUpdate', serializeRoom(room));
    }
  });

  socket.on('restartGame', (roomCode) => {
    const room = engine.getRoom(roomCode);
    if (room) {
      room.status = 'waiting';
      room.history = [];
      room.players.forEach(p => {
        p.points = 50;
        p.status = 'active';
        p.position = null;
        p.currentChallenge = null;
      });
      io.to(room.code).emit('roomUpdate', serializeRoom(room));
    }
  });
});

function serializeRoom(room) {
  return {
    code: room.code,
    status: room.status,
    mode: room.mode,
    players: Array.from(room.players.values()),
    history: room.history.slice(0, 5)
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));