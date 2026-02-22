(() => {
  const config = window.__APP_CONFIG__ || { SOCKET_URL: "" };
  const backendBase = (config.SOCKET_URL || "").replace(/\/$/, "");
  const ioFactory = typeof window.io === "function" ? window.io : null;
  const socket = ioFactory
    ? ioFactory(backendBase || undefined, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity
      })
    : {
        connected: false,
        on() {},
        off() {},
        emit() {}
      };

  const SESSION_KEY = "proteja-sua-casa-session";

  const state = {
    room: null,
    roomCode: "",
    playerId: "",
    reconnectKey: "",
    currentScreen: "screenLogin",
    challengeOpen: false,
    challengeTargetId: null,
    nearbyRooms: [],
    myNotice: "",
    awaitingCreateAck: false,
    createTimeoutId: null
  };

  const $ = (id) => document.getElementById(id);

  const el = {
    roomPill: $("roomPill"),
    connectionBadge: $("connectionBadge"),
    toast: $("toast"),

    screenLogin: $("screenLogin"),
    screenWaiting: $("screenWaiting"),
    screenGame: $("screenGame"),
    screenRanking: $("screenRanking"),

    inputName: $("inputName"),
    inputRoomCode: $("inputRoomCode"),
    btnEnter: $("btnEnter"),
    btnCreate: $("btnCreate"),

    nearbyWrap: $("nearbyWrap"),
    nearbyList: $("nearbyList"),

    waitingPlayers: $("waitingPlayers"),
    waitStatus: $("waitStatus"),
    modeBox: $("modeBox"),
    btnStart: $("btnStart"),
    btnFinish: $("btnFinish"),
    btnRestartWait: $("btnRestartWait"),

    myPoints: $("myPoints"),
    gameGoal: $("gameGoal"),
    updatesPanel: $("updatesPanel"),
    gamePlayers: $("gamePlayers"),
    btnViewWaiting: $("btnViewWaiting"),

    rankNotice: $("rankNotice"),
    rankingList: $("rankingList"),
    lossReport: $("lossReport"),
    attackRanking: $("attackRanking"),
    btnRestartRank: $("btnRestartRank"),
    btnBackWaiting: $("btnBackWaiting"),

    challengeOverlay: $("challengeOverlay"),
    challengeTarget: $("challengeTarget"),
    challengeText: $("challengeText"),
    challengeHint: $("challengeHint"),
    inputAnswer: $("inputAnswer"),
    btnSubmitAnswer: $("btnSubmitAnswer"),
    btnQuitChallenge: $("btnQuitChallenge")
  };

  function sanitizeUpperNoSpace(value) {
    return String(value || "").toUpperCase().replace(/\s+/g, "");
  }

  function showToast(message, isError = false) {
    el.toast.textContent = message;
    el.toast.classList.remove("hidden", "err");
    if (isError) {
      el.toast.classList.add("err");
    }
    setTimeout(() => el.toast.classList.add("hidden"), 2200);
  }

  function socketReady() {
    if (ioFactory) return true;
    showToast("Falha ao carregar tempo real. Recarregue a pagina.", true);
    return false;
  }

  function showScreen(id) {
    [el.screenLogin, el.screenWaiting, el.screenGame, el.screenRanking].forEach((node) => {
      node.classList.remove("active");
    });
    $(id).classList.add("active");
    state.currentScreen = id;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function myPlayer() {
    if (!state.room) return null;
    return (state.room.players || []).find((p) => p.id === state.playerId) || null;
  }

  function saveSession() {
    if (!state.roomCode || !state.playerId || !state.reconnectKey) return;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        roomCode: state.roomCode,
        playerId: state.playerId,
        reconnectKey: state.reconnectKey
      })
    );
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function updateRoomPill() {
    el.roomPill.textContent = `Sala: ${state.roomCode || "--"}`;
  }

  function renderNearby() {
    if (!state.nearbyRooms.length || state.currentScreen !== "screenLogin") {
      el.nearbyWrap.classList.add("hidden");
      el.nearbyList.innerHTML = "";
      return;
    }

    el.nearbyWrap.classList.remove("hidden");
    el.nearbyList.innerHTML = "";

    state.nearbyRooms.forEach((room) => {
      const btn = document.createElement("button");
      btn.className = "nearby-item";
      btn.type = "button";
      btn.textContent = `${room.code} • ${room.players} jogador(es) • ${room.mode || "Palavras"}`;
      btn.addEventListener("click", () => {
        el.inputRoomCode.value = room.code;
        showToast("Código da sala preenchido.");
      });
      el.nearbyList.appendChild(btn);
    });
  }

  function renderWaiting() {
    if (!state.room) return;

    const me = myPlayer();
    const host = Boolean(me?.isHost);

    el.waitStatus.textContent = state.room.status === "playing" ? "Partida em andamento." : "Aguardando host iniciar.";
    el.modeBox.style.display = host ? "block" : "none";
    el.btnStart.style.display = host ? "block" : "none";
    el.btnFinish.style.display = host ? "block" : "none";
    el.btnRestartWait.style.display = host ? "block" : "none";

    const currentMode = state.room.mode || "Palavras";
    const radio = document.querySelector(`input[name='mode'][value='${currentMode}']`);
    if (radio) radio.checked = true;

    el.waitingPlayers.innerHTML = "";
    (state.room.players || []).forEach((p) => {
      const card = document.createElement("div");
      card.className = "player-card";
      card.innerHTML = `
        <div class="player-head">
          <div class="player-name">${p.name}${p.isHost ? " (HOST)" : ""}</div>
          <div class="player-status">${p.connected ? "online" : "offline"}</div>
        </div>
      `;
      el.waitingPlayers.appendChild(card);
    });
  }

  function renderGame() {
    if (!state.room) return;

    const me = myPlayer();
    const myPoints = me ? me.points : 0;
    el.myPoints.textContent = `Seu cofre: ${myPoints}`;
    el.gameGoal.textContent = `Meta: ${state.room.targetGoal || 200}`;

    el.updatesPanel.innerHTML = "";
    (state.room.history || []).forEach((line) => {
      const row = document.createElement("div");
      row.className = "update-item";
      row.textContent = line;
      el.updatesPanel.appendChild(row);
    });

    el.gamePlayers.innerHTML = "";
    (state.room.players || []).forEach((p) => {
      const card = document.createElement("div");
      card.className = "player-card";

      const attackDisabled = !me || me.status !== "active" || p.id === me.id || p.status !== "active";
      card.innerHTML = `
        <div class="player-head">
          <div>
            <div class="player-name">${p.name}</div>
            <div class="player-status">${p.points} ponto(s) • ${p.status}</div>
          </div>
          <button class="btn" ${attackDisabled ? "disabled" : ""}>PEGAR PONTOS</button>
        </div>
      `;

      const btn = card.querySelector("button");
      if (!attackDisabled) {
        btn.addEventListener("click", () => {
          socket.emit("attack", {
            roomCode: state.roomCode,
            attackerId: state.playerId,
            targetId: p.id
          });
        });
      }

      el.gamePlayers.appendChild(card);
    });
  }

  function renderRanking(payload = null) {
    const roomData = payload || state.room;
    if (!roomData) return;

    const ranking = roomData.ranking || [];
    const myRow = ranking.find((r) => r.id === state.playerId);
    const notice = state.myNotice || (myRow ? `Você ficou em ${myRow.position} de ${myRow.outOf}.` : "Resultado atualizado.");
    el.rankNotice.textContent = notice;

    el.rankingList.innerHTML = "";
    ranking.forEach((r) => {
      const row = document.createElement("div");
      row.className = "rank-row";
      row.innerHTML = `<span>${r.position}. ${r.name}</span><span>${r.points} pts (${r.status})</span>`;
      el.rankingList.appendChild(row);
    });

    el.attackRanking.innerHTML = "";
    (roomData.attackRanking || []).forEach((a, index) => {
      const row = document.createElement("div");
      row.className = "report-row";
      row.innerHTML = `<span>${index + 1}. ${a.name}</span><span>${a.stolenTotal} pts em ${a.attacksCount} ataques</span>`;
      el.attackRanking.appendChild(row);
    });

    socket.emit("getMyReport", { roomCode: state.roomCode, playerId: state.playerId });

    const me = myPlayer();
    const isHost = Boolean(me?.isHost);
    el.btnRestartRank.style.display = isHost ? "block" : "none";
  }

  function openChallenge(data) {
    state.challengeOpen = true;
    state.challengeTargetId = data.targetId;
    el.challengeTarget.textContent = `Casa de ${data.targetName}`;
    el.challengeText.textContent = data.text;
    el.challengeHint.textContent = data.hint || "";
    el.inputAnswer.value = "";
    el.challengeOverlay.classList.remove("hidden");
    el.inputAnswer.focus();
  }

  function closeChallenge() {
    state.challengeOpen = false;
    state.challengeTargetId = null;
    el.challengeOverlay.classList.add("hidden");
  }

  function sendJoin() {
    if (!socketReady()) return;
    const name = sanitizeUpperNoSpace(el.inputName.value);
    const code = sanitizeUpperNoSpace(el.inputRoomCode.value);

    el.inputName.value = name;
    el.inputRoomCode.value = code;

    if (!name) {
      showToast("Informe seu nome.", true);
      return;
    }
    if (!code) {
      showToast("Informe o código da sala.", true);
      return;
    }

    socket.emit("joinRoom", { roomCode: code, playerName: name });
  }

  function sendCreate() {
    if (!socketReady()) return;
    if (state.awaitingCreateAck) return;

    if (!socket.connected) {
      showToast("Servidor desconectado. Aguarde reconectar.", true);
      return;
    }

    const name = sanitizeUpperNoSpace(el.inputName.value);
    el.inputName.value = name;
    if (!name) {
      showToast("Informe seu nome para criar sala.", true);
      el.inputName.focus();
      return;
    }

    state.awaitingCreateAck = true;
    el.btnCreate.disabled = true;
    el.btnCreate.textContent = "Criando sala...";
    socket.emit("createRoom", { playerName: name }, (ack) => {
      state.awaitingCreateAck = false;
      if (state.createTimeoutId) {
        clearTimeout(state.createTimeoutId);
        state.createTimeoutId = null;
      }
      el.btnCreate.disabled = false;
      el.btnCreate.textContent = "Criar uma nova sala";

      if (!ack?.ok) {
        showToast(String(ack?.error || "Falha ao criar sala."), true);
      }
    });

    state.createTimeoutId = setTimeout(() => {
      if (!state.awaitingCreateAck) return;
      showToast("Não foi possível criar a sala agora. Tente novamente.", true);
      state.awaitingCreateAck = false;
      el.btnCreate.disabled = false;
      el.btnCreate.textContent = "Criar uma nova sala";
      state.createTimeoutId = null;
    }, 4500);
  }

  el.inputName.addEventListener("input", () => {
    el.inputName.value = sanitizeUpperNoSpace(el.inputName.value);
  });

  el.inputRoomCode.addEventListener("input", () => {
    el.inputRoomCode.value = sanitizeUpperNoSpace(el.inputRoomCode.value);
  });

  el.btnEnter.addEventListener("click", sendJoin);
  el.btnCreate.addEventListener("click", sendCreate);
  el.btnCreate.addEventListener("touchstart", (event) => {
    event.preventDefault();
    sendCreate();
  }, { passive: false });

  el.btnStart.addEventListener("click", () => {
    const checked = document.querySelector("input[name='mode']:checked");
    const mode = checked ? checked.value : "Palavras";
    socket.emit("startGame", { roomCode: state.roomCode, mode });
  });

  el.btnFinish.addEventListener("click", () => {
    socket.emit("finishGame", { roomCode: state.roomCode });
  });

  el.btnRestartWait.addEventListener("click", () => {
    socket.emit("restartGame", { roomCode: state.roomCode });
  });

  el.btnViewWaiting.addEventListener("click", () => {
    showScreen("screenWaiting");
    renderWaiting();
  });

  el.btnBackWaiting.addEventListener("click", () => {
    showScreen("screenWaiting");
    renderWaiting();
  });

  el.btnRestartRank.addEventListener("click", () => {
    socket.emit("restartGame", { roomCode: state.roomCode });
  });

  el.btnSubmitAnswer.addEventListener("click", () => {
    const answer = el.inputAnswer.value.trim();
    socket.emit("submitAnswer", {
      roomCode: state.roomCode,
      playerId: state.playerId,
      answer
    });
  });

  el.btnQuitChallenge.addEventListener("click", () => {
    socket.emit("quitChallenge", {
      roomCode: state.roomCode,
      playerId: state.playerId
    });
  });

  socket.on("connect", () => {
    el.connectionBadge.textContent = "Conectado";
    el.connectionBadge.classList.remove("off");

    const cached = loadSession();
    if (cached?.roomCode && cached?.playerId && cached?.reconnectKey) {
      state.roomCode = cached.roomCode;
      state.playerId = cached.playerId;
      state.reconnectKey = cached.reconnectKey;
      updateRoomPill();
      socket.emit("reconnectRoom", cached);
    }

    socket.emit("findRooms");
  });

  socket.on("disconnect", () => {
    el.connectionBadge.textContent = "Desconectado";
    el.connectionBadge.classList.add("off");
  });

  socket.on("actionError", (msg) => {
    showToast(String(msg || "Ação inválida."), true);
  });

  socket.on("roomsNearby", (rooms) => {
    state.nearbyRooms = Array.isArray(rooms) ? rooms : [];
    renderNearby();
  });

  socket.on("joined", ({ roomCode, playerId, reconnectKey }) => {
    state.awaitingCreateAck = false;
    if (state.createTimeoutId) {
      clearTimeout(state.createTimeoutId);
      state.createTimeoutId = null;
    }
    el.btnCreate.disabled = false;
    el.btnCreate.textContent = "Criar uma nova sala";
    state.roomCode = sanitizeUpperNoSpace(roomCode);
    state.playerId = playerId;
    state.reconnectKey = reconnectKey;
    updateRoomPill();
    saveSession();
    showScreen("screenWaiting");
    showToast(`Entrou na sala ${state.roomCode}.`);
  });

  socket.on("reconnectFailed", () => {
    localStorage.removeItem(SESSION_KEY);
    state.roomCode = "";
    state.playerId = "";
    state.reconnectKey = "";
    updateRoomPill();
    showScreen("screenLogin");
  });

  socket.on("roomUpdate", (room) => {
    state.room = room;
    if (!state.roomCode && room?.code) {
      state.roomCode = room.code;
      updateRoomPill();
      saveSession();
    }

    if (state.currentScreen === "screenWaiting") {
      renderWaiting();
    }

    if (room.status === "playing") {
      if (state.currentScreen !== "screenRanking") {
        showScreen("screenGame");
        renderGame();
      }
      return;
    }

    if (room.status === "waiting") {
      showScreen("screenWaiting");
      renderWaiting();
      return;
    }

    if (room.status === "finished") {
      state.myNotice = "";
      showScreen("screenRanking");
      renderRanking(room);
    }
  });

  socket.on("gameStarted", () => {
    showScreen("screenGame");
    renderGame();
  });

  socket.on("challenge", (data) => {
    openChallenge(data);
  });

  socket.on("challengeResult", (result) => {
    closeChallenge();

    if (result?.message) {
      showToast(result.message, !result.success);
    }

    if (result?.byQuit) {
      state.myNotice = result.message;
    }
  });

  socket.on("playerState", (info) => {
    if (info.type === "eliminated") {
      state.myNotice = `Você foi eliminado e ficou em ${info.position} de ${info.outOf}.`;
      showScreen("screenRanking");
      if (state.room) {
        renderRanking({ ...state.room, ranking: info.ranking, attackRanking: info.attackRanking });
      }
      return;
    }

    if (info.type === "finished") {
      state.myNotice = `Você bateu a meta e ficou em ${info.position} de ${info.outOf}.`;
      showScreen("screenRanking");
      if (state.room) {
        renderRanking({ ...state.room, ranking: info.ranking, attackRanking: info.attackRanking });
      }
    }
  });

  socket.on("myReport", (payload) => {
    el.lossReport.innerHTML = "";
    const losses = payload?.losses || [];

    if (!losses.length) {
      const empty = document.createElement("div");
      empty.className = "report-row";
      empty.innerHTML = "<span>Ninguém pegou seus pontos.</span><span>0</span>";
      el.lossReport.appendChild(empty);
      return;
    }

    losses.forEach((item) => {
      const row = document.createElement("div");
      row.className = "report-row";
      row.innerHTML = `<span>${item.attackerName}</span><span>${item.amount} pts</span>`;
      el.lossReport.appendChild(row);
    });
  });

  socket.on("gameFinished", (room) => {
    state.room = room || state.room;
    state.myNotice = state.myNotice || "Partida finalizada.";
    showScreen("screenRanking");
    renderRanking(state.room);
  });

  socket.on("gameReset", () => {
    state.myNotice = "";
    closeChallenge();
    showScreen("screenWaiting");
    renderWaiting();
    showToast("Partida reiniciada e sala de espera liberada.");
  });

  if (!ioFactory) {
    el.connectionBadge.textContent = "Desconectado";
    el.connectionBadge.classList.add("off");
    setTimeout(() => {
      showToast("Tempo real indisponivel. Verifique o deploy.", true);
    }, 200);
  }

  setInterval(() => {
    if (document.hidden) return;

    socket.emit("keepalive:ping");

    if (backendBase) {
      fetch(`${backendBase}/healthz`, { cache: "no-store" }).catch(() => {});
    }
  }, 40000);

  updateRoomPill();
  renderNearby();
})();
