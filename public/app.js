const SOCKET_URL = window.__APP_CONFIG__?.SOCKET_URL || window.location.origin;
const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

const state = {
  me: null,
  room: null,
  challenge: null,
  updates: []
};

const els = {
  statusLabel: document.getElementById("statusLabel"),
  name: document.getElementById("input-name"),
  code: document.getElementById("input-code"),
  btnCreate: document.getElementById("btn-create"),
  btnJoin: document.getElementById("btn-join"),
  btnStart: document.getElementById("btn-start"),
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
  el.value = (el.value || "").toUpperCase();
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
  if (!state.room) return "ALGUÉM";
  const player = state.room.players.find((p) => p.id === playerId);
  return player?.name || "ALGUÉM";
}

function addUpdate(message) {
  state.updates.unshift(message);
  state.updates = state.updates.slice(0, 6);
  els.updatesList.innerHTML = state.updates.map((item) => `<li>${item}</li>`).join("");
}

function renderLobby() {
  const room = state.room;
  els.roomCode.textContent = room.code;
  els.playersLobby.innerHTML = room.players
    .map((p) => `<li>${p.name}${p.isHost ? " (Host)" : ""}</li>`)
    .join("");

  const s = room.settings;
  els.settings.innerHTML = `
    <h3>Instruções de jogo</h3>
    <div>Pontos iniciais: ${s.initialPoints}</div>
    <div>Meta: ${s.victoryGoal}</div>
    <div>Tentativas: ilimitadas</div>
    <div>Limite por ataque: 10 pontos</div>
  `;

  const me = getMyPlayer();
  els.btnStart.style.display = me && me.isHost ? "block" : "none";
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

function renderRoom() {
  if (!state.room) return;

  if (state.room.status === "lobby") {
    renderLobby();
    showScreen("lobby");
    return;
  }

  if (state.room.status === "finished") {
    showScreen("end");
    return;
  }

  renderMap();
  if (!state.challenge) {
    showScreen("map");
  }
}

function renderEndReports(report) {
  if (!report) {
    els.endPersonalReport.innerHTML = "<li>Sem dados.</li>";
    els.endGlobalRanking.innerHTML = "<li>Sem dados.</li>";
    return;
  }

  const myPersonal = report.personal?.[state.me];
  if (!myPersonal || !myPersonal.byAttacker.length) {
    els.endPersonalReport.innerHTML = "<li>Ninguém pegou seus pontos.</li>";
  } else {
    els.endPersonalReport.innerHTML = myPersonal.byAttacker
      .map((item) => `<li>${item.attackerName}: ${item.points} ponto(s)</li>`)
      .join("");
  }

  if (!report.ranking?.length) {
    els.endGlobalRanking.innerHTML = "<li>Sem ataques registrados.</li>";
    return;
  }
  els.endGlobalRanking.innerHTML = report.ranking
    .map(
      (row) =>
        `<li>${row.playerName} - ${row.totalStolen} ponto(s) roubados (${row.successfulAttacks} acertos / ${row.failedAttacks} falhas)</li>`
    )
    .join("");
}

els.name.addEventListener("input", () => toUpperInput(els.name));
els.code.addEventListener("input", () => toUpperInput(els.code));
els.challengeInput.addEventListener("input", () => toUpperInput(els.challengeInput));

els.btnCreate.addEventListener("click", () => {
  socket.emit("room:create", { name: els.name.value });
});

els.btnJoin.addEventListener("click", () => {
  socket.emit("room:join", { code: els.code.value, name: els.name.value });
});

els.btnStart.addEventListener("click", () => {
  socket.emit("game:start");
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
});

socket.on("disconnect", () => {
  els.statusLabel.textContent = "Reconectando...";
});

socket.on("action:error", (msg) => {
  showToast(msg);
});

socket.on("room:joined", ({ playerId, room }) => {
  state.me = playerId;
  state.room = room;
  state.updates = [];
  els.updatesList.innerHTML = "";
  renderRoom();
});

socket.on("room:update", (room) => {
  state.room = room;
  renderRoom();
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

  els.resultText.textContent = result.success
    ? `Sucesso: +${result.value} pontos.`
    : `Falha: -${result.value} pontos.`;
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
  const winner = state.room.players.find((p) => p.id === winnerId);
  els.endText.textContent = winner ? `Vencedor: ${winner.name}` : "Sem vencedor";
  renderEndReports(report);
  showScreen("end");
});
