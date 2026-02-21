const SOCKET_URL = window.__APP_CONFIG__?.SOCKET_URL || window.location.origin;
const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

const state = {
  me: null,
  room: null,
  challenge: null,
  timerRef: null
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
  hudRound: document.getElementById("hud-round"),
  hudPhase: document.getElementById("hud-phase"),
  hudTimer: document.getElementById("hud-timer"),
  myPoints: document.getElementById("my-points"),
  houses: document.getElementById("grid-houses"),
  challengeTarget: document.getElementById("challenge-target"),
  challengeWord: document.getElementById("challenge-word"),
  challengeInput: document.getElementById("challenge-input"),
  challengeAttempts: document.getElementById("challenge-attempts"),
  challengeTime: document.getElementById("challenge-time"),
  submitAnswer: document.getElementById("btn-submit-answer"),
  resultText: document.getElementById("result-text"),
  endText: document.getElementById("end-text"),
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

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function getMyPlayer() {
  if (!state.room) return null;
  return state.room.players.find((p) => p.id === state.me);
}

function renderLobby() {
  const room = state.room;
  els.roomCode.textContent = room.code;
  els.playersLobby.innerHTML = room.players
    .map((p) => `<li>${p.name}${p.isHost ? " (Host)" : ""}</li>`)
    .join("");

  const s = room.settings;
  els.settings.innerHTML = `
    <h3>Config</h3>
    <div>Pontos iniciais: ${s.initialPoints}</div>
    <div>Meta: ${s.victoryGoal}</div>
    <div>Tempo desafio: ${s.challengeSeconds}s</div>
    <div>Tentativas: ${s.maxAttempts}</div>
  `;

  const me = getMyPlayer();
  els.btnStart.style.display = me && me.isHost ? "block" : "none";
}

function phaseLabel(phase) {
  if (phase === "planning") return "Planejamento";
  if (phase === "execution") return "Desafio";
  if (phase === "result") return "Resultado";
  if (phase === "finished") return "Encerrado";
  return "Lobby";
}

function renderMap() {
  const room = state.room;
  const me = getMyPlayer();

  els.hudRound.textContent = `Rodada ${room.round}`;
  els.hudPhase.textContent = phaseLabel(room.phase);
  els.myPoints.textContent = me ? me.points : 0;

  els.houses.innerHTML = room.players
    .map((p) => {
      const mine = p.id === state.me;
      const deadCls = p.status !== "alive" ? "dead" : "";
      const shieldCls = p.shieldActive ? "shield" : "";
      const disabled = mine || p.status !== "alive" || room.phase !== "planning" || p.shieldActive;
      return `
        <article class="house ${deadCls} ${shieldCls}">
          <strong>${p.name}${mine ? " (Você)" : ""}</strong>
          <div>${p.points} pts</div>
          <div>${p.shieldActive ? "Escudo ativo" : p.status}</div>
          <button data-target="${p.id}" ${disabled ? "disabled" : ""}>Invadir</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("button[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      socket.emit("game:choose-target", { targetId: btn.dataset.target });
      showToast("Invasão escolhida");
    });
  });
}

function renderTimer(deadline) {
  clearInterval(state.timerRef);
  if (!deadline) {
    els.hudTimer.textContent = "0s";
    return;
  }

  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    els.hudTimer.textContent = `${left}s`;
    if (state.challenge) {
      els.challengeTime.textContent = left;
    }
  };

  tick();
  state.timerRef = setInterval(tick, 250);
}

function renderRoom() {
  if (!state.room) return;
  renderTimer(state.room.phaseEndsAt);

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

els.btnCreate.addEventListener("click", () => {
  socket.emit("room:create", { name: els.name.value });
});

els.btnJoin.addEventListener("click", () => {
  socket.emit("room:join", { code: els.code.value, name: els.name.value });
});

els.btnStart.addEventListener("click", () => {
  socket.emit("game:start");
});

els.submitAnswer.addEventListener("click", () => {
  socket.emit("challenge:answer", { answer: els.challengeInput.value });
  els.challengeInput.value = "";
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
  renderRoom();
});

socket.on("room:update", (room) => {
  state.room = room;
  renderRoom();
});

socket.on("phase:update", ({ phaseEndsAt }) => {
  renderTimer(phaseEndsAt);
});

socket.on("challenge:start", (challenge) => {
  state.challenge = challenge;
  const target = state.room.players.find((p) => p.id === challenge.targetId);
  els.challengeTarget.textContent = `Casa alvo: ${target ? target.name : "?"}`;
  els.challengeWord.textContent = challenge.masked;
  els.challengeAttempts.textContent = challenge.attemptsLeft;
  els.challengeTime.textContent = Math.max(0, Math.ceil((challenge.deadline - Date.now()) / 1000));
  showScreen("challenge");
});

socket.on("challenge:attempt", ({ attemptsLeft }) => {
  els.challengeAttempts.textContent = attemptsLeft;
  showToast("Resposta incorreta");
});

socket.on("challenge:resolved", () => {
  state.challenge = null;
  showScreen("map");
});

socket.on("round:result", (result) => {
  state.challenge = null;
  if (!result) {
    els.resultText.textContent = "Sem ação nesta rodada.";
  } else if (result.success) {
    if (result.suffered) {
      els.resultText.textContent = `Você perdeu ${Math.abs(result.value)} pontos.`;
    } else if (result.defended) {
      els.resultText.textContent = `Você recebeu +${result.value} por defesa.`;
    } else {
      els.resultText.textContent = `Sucesso: +${result.value} pontos.`;
    }
  } else {
    els.resultText.textContent = `Falha: -${result.value} pontos.`;
  }

  showScreen("result");
});

socket.on("game:ended", ({ winnerId }) => {
  const winner = state.room.players.find((p) => p.id === winnerId);
  els.endText.textContent = winner ? `Vencedor: ${winner.name}` : "Sem vencedor";
  showScreen("end");
});
