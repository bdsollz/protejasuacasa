const SOCKET_URL = window.__APP_CONFIG__?.SOCKET_URL || window.location.origin;
const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

const SESSION_KEY = "proteja_sua_casa_session";

const state = {
  me: null,
  reconnectKey: null,
  room: null,
  challenge: null,
  updates: [],
  preferSameNetwork: false,
  manualWaiting: false,
  latestRanking: null,
  finalReport: null,
  endNotice: ""
};

const els = {
  statusLabel: document.getElementById("statusLabel"),
  globalRoomCode: document.getElementById("global-room-code"),
  name: document.getElementById("input-name"),
  code: document.getElementById("input-code"),
  activeRoomsList: document.getElementById("active-rooms-list"),
  checkSameNetwork: document.getElementById("check-same-network"),
  btnCreate: document.getElementById("btn-create"),
  btnJoin: document.getElementById("btn-join"),
  btnStart: document.getElementById("btn-start"),
  btnBackGame: document.getElementById("btn-back-game"),
  btnLeaveRoom: document.getElementById("btn-leave-room"),
  btnOpenWaitingMap: document.getElementById("btn-open-waiting-map"),
  btnOpenWaitingChallenge: document.getElementById("btn-open-waiting-challenge"),
  btnOpenWaitingResult: document.getElementById("btn-open-waiting-result"),
  roomCode: document.getElementById("room-code"),
  playersLobby: document.getElementById("players-lobby"),
  settings: document.getElementById("settings"),
  updatesList: document.getElementById("updates-list"),
  myPoints: document.getElementById("my-points"),
  btnFinishGame: document.getElementById("btn-finish-game"),
  houses: document.getElementById("grid-houses"),
  challengeTarget: document.getElementById("challenge-target"),
  challengeHint: document.getElementById("challenge-hint"),
  challengeWord: document.getElementById("challenge-word"),
  challengeInput: document.getElementById("challenge-input"),
  submitAnswer: document.getElementById("btn-submit-answer"),
  quitChallenge: document.getElementById("btn-quit-challenge"),
  resultText: document.getElementById("result-text"),
  endText: document.getElementById("end-text"),
  endRankText: document.getElementById("end-rank-text"),
  endPersonalReport: document.getElementById("end-personal-report"),
  endGlobalRanking: document.getElementById("end-global-ranking"),
  toast: document.getElementById("toast")
};

const screens = {
  entry: document.getElementById("screen-entry"),
  lobby: document.getElementById("screen-lobby"),
  map: document.getElementById("screen-map"),
  challenge: document.getElementById("screen-challenge"),
  result: document.getElementById("screen-result"),
  end: document.getElementById("screen-end")
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function toUpperInput(el) {
  el.value = (el.value || "").toUpperCase().replace(/\s+/g, "");
}

function roomsListFilters() {
  return { sameNetwork: Boolean(state.preferSameNetwork) };
}

function refreshRoomsList() {
  socket.emit("rooms:list", roomsListFilters());
}

function saveSession() {
  if (!state.room || !state.me || !state.reconnectKey) {
    return;
  }
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      roomCode: state.room.code,
      playerId: state.me,
      reconnectKey: state.reconnectKey
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getSavedSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setGlobalRoomCode() {
  els.globalRoomCode.textContent = `Sala: ${state.room?.code || "-"}`;
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function getMyPlayer() {
  if (!state.room) return null;
  return state.room.players.find((p) => p.id === state.me);
}

function getPlayerName(playerId) {
  if (!state.room) return "ALGUEM";
  const player = state.room.players.find((p) => p.id === playerId);
  return player?.name || "ALGUEM";
}

function addUpdate(message) {
  state.updates.unshift(message);
  state.updates = state.updates.slice(0, 8);
  els.updatesList.innerHTML = state.updates.map((item) => `<li>${item}</li>`).join("");
}

function renderActiveRooms(rooms) {
  if (!rooms?.length) {
    els.activeRoomsList.innerHTML = "<li>Nenhuma sala ativa no momento.</li>";
    return;
  }

  els.activeRoomsList.innerHTML = rooms
    .map((room) => `<li><button data-code="${room.code}">Entrar em ${room.code} (${room.connectedPlayers}/${room.players})</button></li>`)
    .join("");

  els.activeRoomsList.querySelectorAll("button[data-code]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.code.value = btn.dataset.code;
      if (!els.name.value.trim()) {
        showToast("Digite seu nome para entrar.");
        return;
      }
      socket.emit("room:join", { code: els.code.value, name: els.name.value });
    });
  });
}

function renderLobby() {
  const room = state.room;
  els.roomCode.textContent = room.code;
  els.playersLobby.innerHTML = room.players
    .map((p) => `${p.name}${p.isHost ? " (Host)" : ""}${p.connected ? "" : " (offline)"}`)
    .map((txt) => `<li>${txt}</li>`)
    .join("");

  const s = room.settings;
  els.settings.innerHTML = `
    <h3>Instruções de jogo</h3>
    <div>Pontos iniciais: ${s.initialPoints}</div>
    <div>Meta: ${s.victoryGoal}</div>
    <div>Tentativas: ilimitadas</div>
    <div>Saque por ataque: 10 pontos fixos</div>
  `;

  const me = getMyPlayer();
  const isHost = Boolean(me && me.isHost);
  els.btnStart.style.display = isHost && room.status === "lobby" ? "block" : "none";
  els.btnBackGame.style.display = room.status === "in_game" ? "block" : "none";
}

function renderMap() {
  const room = state.room;
  const me = getMyPlayer();

  els.myPoints.textContent = me ? me.points : 0;
  els.btnFinishGame.style.display = me && me.isHost ? "block" : "none";

  els.houses.innerHTML = room.players
    .map((p) => {
      const mine = p.id === state.me;
      const deadCls = p.status !== "alive" ? "dead" : "";
      const disabled = mine || p.status !== "alive" || room.status !== "in_game" || state.challenge;
      return `
        <article class="house ${deadCls}">
          <strong>${p.name}${mine ? " (Você)" : ""}</strong>
          <div>${p.points} pts</div>
          <div>${p.status}</div>
          <button data-target="${p.id}" ${disabled ? "disabled" : ""}>Pegar pontos</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("button[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      socket.emit("game:choose-target", { targetId: btn.dataset.target });
    });
  });
}

function renderPlacementRanking(ranking) {
  if (!ranking?.entries?.length) {
    els.endGlobalRanking.innerHTML = "<li>Sem ranking ainda.</li>";
    return;
  }

  els.endGlobalRanking.innerHTML = ranking.entries
    .map((row) => `<li>#${row.position}/${row.outOf} - ${row.playerName} (${row.status})</li>`)
    .join("");
}

function renderPersonalReport(report) {
  const myPersonal = report?.personal?.[state.me];
  if (!myPersonal || !myPersonal.byAttacker.length) {
    els.endPersonalReport.innerHTML = "<li>Ninguém pegou seus pontos.</li>";
    return;
  }

  els.endPersonalReport.innerHTML = myPersonal.byAttacker
    .map((item) => `<li>${item.attackerName}: ${item.points} ponto(s)</li>`)
    .join("");
}

function openRankingScreen() {
  const ranking = state.finalReport?.placementRanking || state.latestRanking;
  renderPlacementRanking(ranking);
  renderPersonalReport(state.finalReport);
  els.endRankText.textContent = state.endNotice || "";
  showScreen("end");
}

function renderRoom() {
  setGlobalRoomCode();

  if (!state.room) {
    showScreen("entry");
    return;
  }

  const me = getMyPlayer();

  if (state.room.status === "lobby") {
    renderLobby();
    showScreen("lobby");
    return;
  }

  if (state.room.status === "in_game") {
    if (me && me.status !== "alive") {
      openRankingScreen();
      return;
    }

    if (state.manualWaiting && screens.lobby.classList.contains("active")) {
      renderLobby();
      return;
    }

    renderMap();
    if (!state.challenge) {
      showScreen("map");
    }
    return;
  }

  if (state.room.status === "finished") {
    openRankingScreen();
  }
}

function connectFromSavedSession() {
  const saved = getSavedSession();
  if (!saved?.roomCode || !saved?.playerId || !saved?.reconnectKey) {
    return;
  }

  socket.emit("room:reconnect", {
    code: saved.roomCode,
    playerId: saved.playerId,
    reconnectKey: saved.reconnectKey
  });
}

els.name.addEventListener("input", () => toUpperInput(els.name));
els.code.addEventListener("input", () => toUpperInput(els.code));
els.challengeInput.addEventListener("input", () => toUpperInput(els.challengeInput));

els.checkSameNetwork.addEventListener("change", () => {
  state.preferSameNetwork = els.checkSameNetwork.checked;
  refreshRoomsList();
});

els.btnCreate.addEventListener("click", () => {
  socket.emit("room:create", { name: els.name.value });
});

els.btnJoin.addEventListener("click", () => {
  socket.emit("room:join", { code: els.code.value, name: els.name.value });
});

els.btnStart.addEventListener("click", () => {
  socket.emit("game:start");
});

els.btnBackGame.addEventListener("click", () => {
  state.manualWaiting = false;
  showScreen("map");
  renderRoom();
});

els.btnLeaveRoom.addEventListener("click", () => {
  socket.emit("room:leave");
  state.room = null;
  state.me = null;
  state.reconnectKey = null;
  state.challenge = null;
  state.finalReport = null;
  state.latestRanking = null;
  state.endNotice = "";
  clearSession();
  setGlobalRoomCode();
  showScreen("entry");
  refreshRoomsList();
});

els.btnOpenWaitingMap.addEventListener("click", () => {
  state.manualWaiting = true;
  renderLobby();
  showScreen("lobby");
});

els.btnOpenWaitingChallenge.addEventListener("click", () => {
  state.manualWaiting = true;
  renderLobby();
  showScreen("lobby");
});

els.btnOpenWaitingResult.addEventListener("click", () => {
  state.manualWaiting = true;
  renderLobby();
  showScreen("lobby");
});

els.btnFinishGame.addEventListener("click", () => {
  socket.emit("game:finish");
});

els.submitAnswer.addEventListener("click", () => {
  socket.emit("challenge:answer", { answer: els.challengeInput.value });
  els.challengeInput.value = "";
});

els.quitChallenge.addEventListener("click", () => {
  socket.emit("challenge:quit");
});

socket.on("connect", () => {
  els.statusLabel.textContent = "Conectado";
  refreshRoomsList();
  connectFromSavedSession();
});

socket.on("disconnect", () => {
  els.statusLabel.textContent = "Reconectando...";
});

socket.on("action:error", (msg) => {
  showToast(msg);
});

socket.on("room:reconnect-failed", () => {
  clearSession();
});

socket.on("rooms:active", (rooms) => {
  if (state.room) {
    return;
  }
  renderActiveRooms(rooms);
});

socket.on("room:joined", ({ playerId, reconnectKey, room }) => {
  state.me = playerId;
  state.reconnectKey = reconnectKey;
  state.room = room;
  state.latestRanking = room.ranking || null;
  state.updates = [];
  state.challenge = null;
  state.manualWaiting = false;
  state.finalReport = null;
  state.endNotice = "";
  els.updatesList.innerHTML = "";
  saveSession();
  renderRoom();
});

socket.on("room:update", (room) => {
  const becameInGame = state.room?.status !== "in_game" && room.status === "in_game";
  state.room = room;
  state.latestRanking = room.ranking || state.latestRanking;

  if (becameInGame) {
    state.manualWaiting = false;
  }

  saveSession();
  renderRoom();
});

socket.on("ranking:update", (ranking) => {
  state.latestRanking = ranking;
  if (screens.end.classList.contains("active")) {
    renderPlacementRanking(ranking);
  }
});

socket.on("player:state", ({ type, position, outOf, ranking }) => {
  state.latestRanking = ranking || state.latestRanking;

  if (type === "eliminated") {
    state.endNotice = `Você foi eliminado. Posição: ${position}/${outOf}.`;
    openRankingScreen();
    return;
  }

  if (type === "finished") {
    state.endNotice = `Você atingiu a meta. Posição: ${position}/${outOf}.`;
    openRankingScreen();
  }
});

socket.on("game:started", () => {
  state.manualWaiting = false;
  if (!state.challenge) {
    showScreen("map");
  }
});

socket.on("challenge:start", (challenge) => {
  state.challenge = challenge;
  const target = state.room.players.find((p) => p.id === challenge.targetId);
  els.challengeTarget.textContent = `Casa alvo para pegar pontos: ${target ? target.name : "?"}`;
  els.challengeHint.textContent = `Dica: ${challenge.hint}`;
  els.challengeWord.textContent = challenge.masked;
  showScreen("challenge");
});

socket.on("challenge:attempt", () => {
  showToast("Resposta incorreta");
});

socket.on("challenge:resolved", (result) => {
  state.challenge = null;
  if (!result) {
    showScreen("map");
    return;
  }

  els.resultText.textContent = result.success ? `Sucesso: +${result.value} pontos.` : `Falha: -${result.value} pontos.`;
  showScreen("result");
  setTimeout(() => {
    if (state.room?.status === "in_game") {
      showScreen("map");
    }
  }, 1300);
});

socket.on("attack:result", (result) => {
  if (!state.room || !result) return;
  const me = getMyPlayer();
  if (!me) return;

  if (result.attackerId === me.id) {
    return;
  }

  if (result.targetId === me.id) {
    const attackerName = getPlayerName(result.attackerId);
    if (result.success) {
      const msg = `${attackerName} tirou ${result.value} ponto(s) de você.`;
      addUpdate(msg);
      showToast(msg);
      return;
    }

    const msg = `${attackerName} errou e te deu ${result.value} ponto(s).`;
    addUpdate(msg);
    showToast(msg);
  }
});

socket.on("game:ended", ({ winnerId, report }) => {
  state.finalReport = report || null;
  state.latestRanking = report?.placementRanking || state.latestRanking;

  const winner = state.room.players.find((p) => p.id === winnerId);
  els.endText.textContent = winner ? `Partida encerrada. Líder: ${winner.name}` : "Partida encerrada.";
  if (!state.endNotice) {
    const myRow = state.latestRanking?.entries?.find((row) => row.playerId === state.me);
    if (myRow) {
      state.endNotice = `Sua posição final: ${myRow.position}/${myRow.outOf}.`;
    }
  }

  openRankingScreen();
});

setGlobalRoomCode();
renderActiveRooms([]);
