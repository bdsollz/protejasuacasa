import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { motion } from "framer-motion";
import { Button, Card, ListItem, Modal, TextField, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useMotionPreference } from "@/lib/motion";

type PlayerStatus = "active" | "finished" | "eliminated";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  status: PlayerStatus;
  points: number;
  position: number | null;
  stolenTotal: number;
  attacksCount: number;
};

type RankingRow = {
  position: number;
  outOf: number;
  id: string;
  name: string;
  status: PlayerStatus;
  points: number;
  attacksCount: number;
  stolenTotal: number;
};

type AttackRankingRow = {
  id: string;
  name: string;
  attacksCount: number;
  stolenTotal: number;
};

type Room = {
  code: string;
  status: "waiting" | "playing" | "finished";
  mode: "Palavras" | "Palavras e Contas";
  targetGoal: number;
  players: Player[];
  history: string[];
  ranking: RankingRow[];
  attackRanking: AttackRankingRow[];
};

type Challenge = {
  targetId: string;
  targetName: string;
  text: string;
  hint: string;
  answerType: "text" | "number";
};

type NearbyRoom = {
  code: string;
  mode: string;
  players: number;
  connected: number;
};

type LossReportRow = {
  attackerId: string;
  attackerName: string;
  amount: number;
};

type PlayerStateEvent = {
  type: "finished" | "eliminated";
  playerId: string;
  position: number;
  outOf: number;
  ranking: RankingRow[];
  attackRanking: AttackRankingRow[];
};

type Screen = "login" | "waiting" | "game" | "ranking";

type SavedSession = {
  roomCode: string;
  playerId: string;
  reconnectKey: string;
};

const SESSION_KEY = "psc.game.session";

function sanitizeUpperNoSpace(value: string) {
  return String(value || "").toUpperCase().replace(/\s+/g, "");
}

function sanitizeNoSpace(value: string) {
  return String(value || "").replace(/\s+/g, "");
}

export function GameApp() {
  const { pushToast } = useToast();
  const { shouldReduceMotion } = useMotionPreference();

  const backendBase = useMemo(
    () => (import.meta.env.VITE_SOCKET_URL || "https://proteja-sua-casa.onrender.com").replace(/\/$/, ""),
    []
  );

  const socketRef = useRef<Socket | null>(null);

  const [screen, setScreen] = useState<Screen>("login");
  const [waitingViewLocked, setWaitingViewLocked] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [reconnectKey, setReconnectKey] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [modeInput, setModeInput] = useState<"Palavras" | "Palavras e Contas">("Palavras");

  const [nearbyRooms, setNearbyRooms] = useState<NearbyRoom[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answerInput, setAnswerInput] = useState("");

  const [lossReport, setLossReport] = useState<LossReportRow[]>([]);
  const [myNotice, setMyNotice] = useState("");

  const createTimeoutRef = useRef<number | null>(null);
  const sessionRef = useRef<SavedSession>({ roomCode: "", playerId: "", reconnectKey: "" });
  const screenRef = useRef<Screen>("login");
  const waitingViewLockedRef = useRef(false);

  const me = useMemo(() => room?.players.find((p) => p.id === playerId) ?? null, [room, playerId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSession;
        setRoomCode(parsed.roomCode || "");
        setPlayerId(parsed.playerId || "");
        setReconnectKey(parsed.reconnectKey || "");
      }
    } catch {
      // ignora sessão inválida
    }
  }, []);

  useEffect(() => {
    sessionRef.current = { roomCode, playerId, reconnectKey };
  }, [roomCode, playerId, reconnectKey]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    waitingViewLockedRef.current = waitingViewLocked;
  }, [waitingViewLocked]);

  useEffect(() => {
    const socket = io(backendBase || undefined, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity
    });

    socketRef.current = socket;
    setIsConnected(socket.connected);

    const onConnect = () => {
      setIsConnected(true);
      socket.emit("findRooms");

      if (
        sessionRef.current.roomCode &&
        sessionRef.current.playerId &&
        sessionRef.current.reconnectKey
      ) {
        socket.emit("reconnectRoom", {
          roomCode: sessionRef.current.roomCode,
          playerId: sessionRef.current.playerId,
          reconnectKey: sessionRef.current.reconnectKey
        });
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = () => {
      setIsConnected(false);
    };

    const onActionError = (msg: string) => {
      pushToast(String(msg || "Ação inválida"), "danger");
      setCreatingRoom(false);
      if (createTimeoutRef.current) {
        window.clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
    };

    const onNearby = (rooms: NearbyRoom[]) => {
      setNearbyRooms(Array.isArray(rooms) ? rooms : []);
    };

    const onJoined = (payload: { roomCode: string; playerId: string; reconnectKey: string }) => {
      setCreatingRoom(false);
      if (createTimeoutRef.current) {
        window.clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }

      setRoomCode(payload.roomCode);
      setCodeInput(payload.roomCode);
      setPlayerId(payload.playerId);
      setReconnectKey(payload.reconnectKey);
      setScreen("waiting");
      setWaitingViewLocked(false);

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          roomCode: payload.roomCode,
          playerId: payload.playerId,
          reconnectKey: payload.reconnectKey
        })
      );

      pushToast(`Entrou na sala ${payload.roomCode}`, "success");
    };

    const onReconnectFailed = () => {
      localStorage.removeItem(SESSION_KEY);
      setRoomCode("");
      setPlayerId("");
      setReconnectKey("");
      setScreen("login");
      setRoom(null);
      setChallenge(null);
      setWaitingViewLocked(false);
    };

    const onRoomUpdate = (nextRoom: Room) => {
      setRoom(nextRoom);
      setModeInput(nextRoom.mode || "Palavras");
      setRoomCode((prev) => prev || nextRoom.code);
      setCodeInput((prev) => prev || nextRoom.code);

      if (nextRoom.status === "waiting") {
        setScreen("waiting");
      }

      if (nextRoom.status === "playing") {
        if (screenRef.current !== "ranking") {
          setScreen(waitingViewLockedRef.current ? "waiting" : "game");
        }
      }

      if (nextRoom.status === "finished") {
        setScreen("ranking");
        setWaitingViewLocked(false);
      }
    };

    const onGameStarted = () => {
      if (!waitingViewLockedRef.current) {
        setScreen("game");
      }
      pushToast("Partida iniciada", "success");
    };

    const onChallenge = (payload: Challenge) => {
      setChallenge(payload);
      setAnswerInput("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const onChallengeResult = (result: { success: boolean; message?: string; byQuit?: boolean }) => {
      setChallenge(null);
      setAnswerInput("");
      if (result?.message) {
        pushToast(result.message, result.success ? "success" : "danger");
      }
      if (result?.byQuit && result?.message) {
        setMyNotice(result.message);
      }
    };

    const onPlayerState = (event: PlayerStateEvent) => {
      if (event.playerId !== playerId) return;

      if (event.type === "eliminated") {
        setMyNotice(`Você foi eliminado e ficou em ${event.position} de ${event.outOf}.`);
      } else {
        setMyNotice(`Você bateu a meta e ficou em ${event.position} de ${event.outOf}.`);
      }

      setScreen("ranking");
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              ranking: event.ranking,
              attackRanking: event.attackRanking
            }
          : prev
      );
    };

    const onMyReport = (payload: { losses: LossReportRow[] }) => {
      setLossReport(Array.isArray(payload?.losses) ? payload.losses : []);
    };

    const onGameFinished = (finalRoom: Room) => {
      setRoom(finalRoom);
      setScreen("ranking");
    };

    const onGameReset = () => {
      setChallenge(null);
      setAnswerInput("");
      setMyNotice("");
      setScreen("waiting");
      setWaitingViewLocked(false);
      pushToast("Partida reiniciada", "success");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("actionError", onActionError);
    socket.on("roomsNearby", onNearby);
    socket.on("joined", onJoined);
    socket.on("reconnectFailed", onReconnectFailed);
    socket.on("roomUpdate", onRoomUpdate);
    socket.on("gameStarted", onGameStarted);
    socket.on("challenge", onChallenge);
    socket.on("challengeResult", onChallengeResult);
    socket.on("playerState", onPlayerState);
    socket.on("myReport", onMyReport);
    socket.on("gameFinished", onGameFinished);
    socket.on("gameReset", onGameReset);

    return () => {
      if (createTimeoutRef.current) {
        window.clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("actionError", onActionError);
      socket.off("roomsNearby", onNearby);
      socket.off("joined", onJoined);
      socket.off("reconnectFailed", onReconnectFailed);
      socket.off("roomUpdate", onRoomUpdate);
      socket.off("gameStarted", onGameStarted);
      socket.off("challenge", onChallenge);
      socket.off("challengeResult", onChallengeResult);
      socket.off("playerState", onPlayerState);
      socket.off("myReport", onMyReport);
      socket.off("gameFinished", onGameFinished);
      socket.off("gameReset", onGameReset);
      socket.disconnect();
    };
  }, [backendBase, pushToast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (screen !== "game") {
      setChallenge(null);
      setAnswerInput("");
    }
  }, [screen]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const heartbeatId = window.setInterval(() => {
      if (document.hidden) return;
      socket.emit("keepalive:ping");
      if (backendBase) {
        fetch(`${backendBase}/healthz`, { cache: "no-store" }).catch(() => undefined);
      }
    }, 40000);

    return () => window.clearInterval(heartbeatId);
  }, [backendBase]);

  useEffect(() => {
    if (screen !== "ranking" || !roomCode || !playerId) return;
    socketRef.current?.emit("getMyReport", { roomCode, playerId });
  }, [screen, roomCode, playerId, room]);

  function createRoom() {
    const socket = socketRef.current;
    if (!socket) {
      setIsConnected(false);
      pushToast("Servidor desconectado. Aguarde reconectar.", "danger");
      return;
    }

    if (!socket.connected) {
      socket.connect();
      setIsConnected(false);
      pushToast("Servidor desconectado. Reconectando...", "danger");
      return;
    }

    const playerName = sanitizeUpperNoSpace(nameInput);
    setNameInput(playerName);

    if (!playerName) {
      pushToast("Informe seu nome.", "danger");
      return;
    }

    if (creatingRoom) return;
    setCreatingRoom(true);

    socket.timeout(4500).emit(
      "createRoom",
      { playerName },
      (err: Error | null, ack?: { ok: boolean; error?: string }) => {
        if (err) {
          setCreatingRoom(false);
          if (createTimeoutRef.current) {
            window.clearTimeout(createTimeoutRef.current);
            createTimeoutRef.current = null;
          }
          pushToast("Falha ao criar sala. Tente novamente.", "danger");
          return;
        }

        if (ack && !ack.ok) {
          setCreatingRoom(false);
          if (createTimeoutRef.current) {
            window.clearTimeout(createTimeoutRef.current);
            createTimeoutRef.current = null;
          }
          pushToast(ack.error || "Falha ao criar sala.", "danger");
        }
      }
    );

    createTimeoutRef.current = window.setTimeout(() => {
      setCreatingRoom(false);
      pushToast("Criação demorou. Tente novamente.", "danger");
    }, 5000);
  }

  function joinRoom() {
    const socket = socketRef.current;
    if (!socket) {
      setIsConnected(false);
      pushToast("Servidor desconectado. Aguarde reconectar.", "danger");
      return;
    }

    if (!socket.connected) {
      socket.connect();
      setIsConnected(false);
      pushToast("Servidor desconectado. Reconectando...", "danger");
      return;
    }

    const playerName = sanitizeUpperNoSpace(nameInput);
    const code = sanitizeUpperNoSpace(codeInput);

    setNameInput(playerName);
    setCodeInput(code);

    if (!playerName || !code) {
      pushToast("Informe nome e código da sala.", "danger");
      return;
    }

    socket.emit("joinRoom", { roomCode: code, playerName });
  }

  function startGame() {
    if (!roomCode) return;
    socketRef.current?.emit("startGame", { roomCode, mode: modeInput });
    setWaitingViewLocked(false);
  }

  function finishGame() {
    if (!roomCode) return;
    socketRef.current?.emit("finishGame", { roomCode });
  }

  function restartGame() {
    if (!roomCode) return;
    socketRef.current?.emit("restartGame", { roomCode });
  }

  function attack(targetId: string) {
    if (!roomCode || !playerId) return;
    socketRef.current?.emit("attack", { roomCode, attackerId: playerId, targetId });
  }

  function submitAnswer() {
    if (!roomCode || !playerId) return;
    const answer = sanitizeNoSpace(answerInput);
    setAnswerInput(answer);
    socketRef.current?.emit("submitAnswer", { roomCode, playerId, answer });
  }

  function quitChallenge() {
    if (!roomCode || !playerId) return;
    socketRef.current?.emit("quitChallenge", { roomCode, playerId });
  }

  function openWaitingDuringGame() {
    setWaitingViewLocked(true);
    setScreen("waiting");
  }

  function backToGame() {
    setWaitingViewLocked(false);
    if (room?.status === "playing") {
      setScreen("game");
    }
  }

  const canStart = Boolean(me?.isHost) && room?.status === "waiting";
  const canFinish = Boolean(me?.isHost) && room?.status === "playing";
  const canRestart = Boolean(me?.isHost) && (room?.status === "playing" || room?.status === "finished");

  return (
    <motion.div
      className="mx-auto max-w-4xl px-4 py-6 md:px-6"
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.1 : 0.26, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="mb-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-label text-[var(--color-muted)]">Proteja sua Casa</p>
            <h1 className="text-h1">Jogo em tempo real</h1>
          </div>
          <div className="text-small">
            <p>
              Sala: <strong>{roomCode || "--"}</strong>
            </p>
            <p className={isConnected ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </p>
          </div>
        </div>
      </Card>

      {screen === "login" ? (
        <Card className="space-y-4">
          <h2 className="text-h2">Entrar no jogo</h2>

          <TextField
            label="Seu nome"
            value={nameInput}
            onChange={(event) => setNameInput(sanitizeUpperNoSpace(event.target.value))}
            placeholder="EX: BRUNO"
            required
          />

          <TextField
            label="Código da sala"
            value={codeInput}
            onChange={(event) => setCodeInput(sanitizeUpperNoSpace(event.target.value))}
            placeholder="EX: AB12CD"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={joinRoom} disabled={!isConnected}>
              Entrar
            </Button>
            <Button
              variant="secondary"
              onClick={createRoom}
              loading={creatingRoom}
              disabled={!isConnected}
            >
              Criar nova sala
            </Button>
          </div>

          {nearbyRooms.length > 0 ? (
            <div className="space-y-2">
              <p className="text-label text-[var(--color-muted)]">Salas ativas próximas</p>
              {nearbyRooms.map((item) => (
                <ListItem
                  key={item.code}
                  title={`${item.code} • ${item.players} jogador(es)`}
                  description={item.mode}
                  leading={<Icon name="home" className="h-4 w-4" />}
                  trailing={<Icon name="arrow-right" className="h-4 w-4" />}
                  onClick={() => setCodeInput(item.code)}
                />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {screen === "waiting" ? (
        <Card className="space-y-4">
          <h2 className="text-h2">Sala de espera</h2>
          <p className="text-small text-[var(--color-muted)]">
            {room?.status === "playing" ? "Partida em andamento" : "Aguardando host iniciar"}
          </p>

          <label className="text-label text-[var(--color-muted)]" htmlFor="mode-select">
            Modo do jogo
          </label>
          <select
            id="mode-select"
            className="focus-ring w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2.5"
            value={modeInput}
            onChange={(event) => setModeInput(event.target.value as "Palavras" | "Palavras e Contas")}
            disabled={!me?.isHost}
          >
            <option value="Palavras">Palavras</option>
            <option value="Palavras e Contas">Palavras e Contas</option>
          </select>

          <div className="space-y-2">
            {(room?.players || []).map((player) => (
              <ListItem
                key={player.id}
                title={`${player.name}${player.isHost ? " (HOST)" : ""}`}
                description={`${player.connected ? "online" : "offline"} • ${player.status}`}
                leading={<Icon name="home" className="h-4 w-4" />}
              />
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {canStart ? <Button onClick={startGame}>Iniciar partida</Button> : null}
            {room?.status === "playing" ? (
              <Button variant="secondary" onClick={backToGame}>
                Voltar ao jogo
              </Button>
            ) : null}
            {canFinish ? (
              <Button variant="danger" onClick={finishGame}>
                Finalizar partida
              </Button>
            ) : null}
            {canRestart ? (
              <Button variant="ghost" onClick={restartGame}>
                Reiniciar jogo
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {screen === "game" ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body">
              Seu cofre: <strong>{me?.points ?? 0}</strong>
            </p>
            <p className="text-body">
              Meta: <strong>{room?.targetGoal ?? 200}</strong>
            </p>
          </div>

          <Card variant="outlined" className="space-y-2">
            <p className="text-label text-[var(--color-muted)]">Atualizações</p>
            {(room?.history || []).length ? (
              (room?.history || []).slice(0, 8).map((line) => (
                <p key={line} className="text-small">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-small text-[var(--color-muted)]">Sem atualizações ainda.</p>
            )}
          </Card>

          <div className="space-y-2">
            {(room?.players || []).map((player) => {
              const canAttack =
                player.id !== me?.id &&
                player.status === "active" &&
                me?.status === "active" &&
                Boolean(roomCode && playerId);

              return (
                <div key={player.id} className="surface rounded-md p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-body font-semibold">{player.name}</p>
                      <p className="text-small text-[var(--color-muted)]">
                        {player.points} ponto(s) • {player.status}
                      </p>
                    </div>
                    <Button disabled={!canAttack} onClick={() => attack(player.id)}>
                      PEGAR PONTOS
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={openWaitingDuringGame}>
              Ver sala de espera
            </Button>
            {canFinish ? (
              <Button variant="danger" onClick={finishGame}>
                Finalizar partida
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {screen === "ranking" ? (
        <Card className="space-y-4">
          <h2 className="text-h2">Ranking</h2>
          <p className="text-small text-[var(--color-muted)]">{myNotice || "Resultado da partida"}</p>

          <div className="space-y-2">
            {(room?.ranking || []).map((row) => (
              <ListItem
                key={row.id}
                title={`${row.position}. ${row.name}`}
                description={`${row.points} pontos • ${row.status}`}
                leading={<Icon name="check" className="h-4 w-4" />}
              />
            ))}
          </div>

          <Card variant="outlined" className="space-y-2">
            <p className="text-label text-[var(--color-muted)]">Quem pegou seus pontos</p>
            {lossReport.length ? (
              lossReport.map((item) => (
                <p key={`${item.attackerId}-${item.amount}`} className="text-small">
                  {item.attackerName}: {item.amount} pontos
                </p>
              ))
            ) : (
              <p className="text-small text-[var(--color-muted)]">Ninguém pegou seus pontos.</p>
            )}
          </Card>

          <Card variant="outlined" className="space-y-2">
            <p className="text-label text-[var(--color-muted)]">Ranking de ataques</p>
            {(room?.attackRanking || []).map((item, idx) => (
              <p key={item.id} className="text-small">
                {idx + 1}. {item.name} — {item.stolenTotal} pts ({item.attacksCount} ataques)
              </p>
            ))}
          </Card>

          <div className="grid gap-2 sm:grid-cols-2">
            {canRestart ? (
              <Button onClick={restartGame}>Reiniciar jogo</Button>
            ) : (
              <Button variant="secondary" onClick={() => setScreen("waiting")}>
                Voltar para sala
              </Button>
            )}
            {room?.status === "playing" ? (
              <Button variant="ghost" onClick={backToGame}>
                Voltar ao jogo
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Modal
        open={Boolean(challenge)}
        title={challenge ? `Casa de ${challenge.targetName}` : "Desafio"}
        description={challenge?.hint || "Resolva para pegar pontos"}
        onClose={quitChallenge}
      >
        <div className="space-y-3">
          <p className="text-h2 tracking-wide">{challenge?.text}</p>
          <TextField
            label="Resposta"
            value={answerInput}
            onChange={(event) => setAnswerInput(sanitizeNoSpace(event.target.value))}
            autoFocus
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={submitAnswer}>Enviar</Button>
            <Button variant="ghost" onClick={quitChallenge}>
              Sair da casa
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
