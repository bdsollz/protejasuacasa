const socket = io();
let state = { roomCode: '', playerId: '', isHost: false };

const showScreen = (name) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${name}`).classList.remove('hidden');
    window.scrollTo(0,0);
};

document.getElementById('btn-create-trigger').onclick = (e) => {
    e.preventDefault();
    socket.emit('createRoom');
};

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('input-name').value.trim().toUpperCase();
    const code = document.getElementById('input-room').value.trim().toUpperCase();
    if (name && code) {
        state.roomCode = code;
        socket.emit('joinRoom', { roomCode: code, playerName: name });
    }
};

socket.on('roomCreated', (code) => {
    state.isHost = true;
    document.getElementById('input-room').value = code;
    document.getElementById('btn-join').click();
});

socket.on('joined', ({ playerId }) => {
    state.playerId = playerId;
    showScreen('lobby');
});

socket.on('roomUpdate', (room) => {
    document.querySelectorAll('.room-code-txt, #display-room').forEach(el => el.innerText = room.code);
    
    if (room.status === 'playing') {
        showScreen('game');
        renderGame(room);
    } else {
        renderLobby(room);
    }
    
    if (room.players.filter(p => p.status === 'active').length <= 1 && room.status === 'playing') {
        renderRanking(room);
    }
});

function renderLobby(room) {
    const list = document.getElementById('player-list-lobby');
    list.innerHTML = room.players.map(p => `<div class="list-item"><span>${p.name}</span> <b>${p.points} PTS</b></div>`).join('');
    if (state.isHost) document.getElementById('host-controls').classList.remove('hidden');
}

function renderGame(room) {
    const me = room.players.find(p => p.id === state.playerId);
    document.getElementById('my-points').innerText = me.points;
    
    const grid = document.getElementById('player-grid');
    grid.innerHTML = room.players.map(p => {
        if (p.id === state.playerId) return '';
        return `
            <div class="player-card ${p.status}">
                <b>${p.name}</b>
                <p>${p.points} PTS</p>
                ${p.status === 'active' ? `<button onclick="attack('${p.id}')" class="btn-primary" style="margin-top:10px; padding:10px; font-size:0.7rem">PEGAR PONTOS</button>` : `<div style="color:var(--text-dim); font-size:0.7rem; margin-top:10px">${p.status.toUpperCase()}</div>`}
            </div>
        `;
    }).join('');

    document.getElementById('updates-panel').innerHTML = room.history.map(h => `<div>• ${h}</div>`).join('');
}

function renderRanking(room) {
    showScreen('ranking');
    const sorted = [...room.players].sort((a,b) => (a.position || 99) - (b.position || 99) || b.points - a.points);
    document.getElementById('ranking-list').innerHTML = sorted.map((p, i) => `
        <div class="list-item">
            <span>#${i+1} ${p.name}</span>
            <b>${p.points} PTS</b>
        </div>
    `).join('');
    if (state.isHost) document.getElementById('btn-host-restart').classList.remove('hidden');
}

window.attack = (targetId) => socket.emit('attack', { roomCode: state.roomCode, attackerId: state.playerId, targetId });

socket.on('challenge', (text) => {
    document.getElementById('challenge-text').innerText = text;
    document.getElementById('challenge-area').classList.remove('hidden');
    document.getElementById('input-answer').value = '';
    document.getElementById('input-answer').focus();
});

document.getElementById('btn-submit').onclick = () => {
    const answer = document.getElementById('input-answer').value;
    socket.emit('submitAnswer', { roomCode: state.roomCode, playerId: state.playerId, answer });
};

socket.on('challengeResult', (res) => {
    if (res.success) document.getElementById('challenge-area').classList.add('hidden');
    else alert('Incorreto!');
});

document.getElementById('btn-quit-challenge').onclick = () => {
    socket.emit('quitChallenge', { roomCode: state.roomCode, playerId: state.playerId });
    document.getElementById('challenge-area').classList.add('hidden');
};

document.getElementById('btn-start').onclick = () => {
    socket.emit('startGame', { roomCode: state.roomCode, mode: document.getElementById('select-mode').value });
};

document.getElementById('btn-host-restart').onclick = () => socket.emit('restartGame', state.roomCode);
document.getElementById('btn-go-lobby').onclick = () => showScreen('lobby');

socket.on('roomsNearby', (rooms) => {
    const div = document.getElementById('nearby-rooms');
    div.innerHTML = rooms.map(code => `<div class="nearby-room-item" onclick="document.getElementById('input-room').value='${code}'">Entrar na Sala ${code}</div>`).join('');
});

socket.on('error', (msg) => alert(msg));
setInterval(() => socket.emit('findRooms'), 5000);