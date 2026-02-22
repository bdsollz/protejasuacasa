import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "./types";

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 20000,
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});

export default socket;