import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Room, Player, Challenge, GameMode, GameUpdate } from "./src/types";
import crypto from "crypto";

const PORT = Number(process.env.PORT) || 3000;

// ... (mantenha as funções WORDS_BANK, generateRoomCode, getIpHash, normalize, createChallenge iguais)

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

  // ... (mantenha toda a lógica do io.on("connection", ...) igual)

  app.get("/healthz", (req, res) => {
    res.send("ok");
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();