import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Sword, 
  Users, 
  Settings, 
  Trophy, 
  LogOut, 
  Play, 
  RefreshCw,
  AlertCircle,
  ChevronRight,
  History
} from 'lucide-react';
import socket from './socket';
import { Room, Player, Challenge, GameMode, GameUpdate } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [discoveredRooms, setDiscoveredRooms] = useState<{ code: string; hostName: string }[]>([]);
  const [view, setView] = useState<'LOGIN' | 'LOBBY' | 'GAME' | 'RANKING'>('LOGIN');

  const updatesEndRef = useRef<HTMLDivElement>(null);

  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    };
    const onDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Auto-reconnect check - ONLY ONCE ON MOUNT
    const savedCode = localStorage.getItem('roomCode');
    const savedName = localStorage.getItem('playerName');
    const savedKey = localStorage.getItem('reconnectKey');

    if (savedCode && savedName && savedKey) {
      console.log('Attempting auto-reconnect...', { savedCode, savedName });
      socket.emit('join_room', { playerName: savedName, roomCode: savedCode, reconnectKey: savedKey });
    }

    const onRoomState = (newRoom: Room) => {
      console.log('Received room_state:', newRoom.code, newRoom.status);
      setRoom(newRoom);
      localStorage.setItem('roomCode', newRoom.code);
      const me = (Object.values(newRoom.players) as Player[]).find(p => p.id === socket.id);
      if (me) {
        localStorage.setItem('playerName', me.name);
        localStorage.setItem('reconnectKey', me.reconnectKey);
      }

      if (newRoom.status === 'LOBBY') setView('LOBBY');
      else if (newRoom.status === 'ACTIVE') setView('GAME');
      else if (newRoom.status === 'FINISHED') setView('RANKING');
      
      window.scrollTo(0, 0);
    };

    const onChallengeStart = (newChallenge: Challenge) => {
      setChallenge(newChallenge);
      setAnswer('');
      window.scrollTo(0, 0);
    };

    const onChallengeResult = ({ success, message }: { success: boolean; message: string }) => {
      if (success) {
        setChallenge(null);
      } else {
        setError(message);
        setTimeout(() => setError(null), 2000);
      }
    };

    const onError = (msg: string) => {
      console.error('Socket error received:', msg);
      setError(msg);
      setTimeout(() => setError(null), 3000);
    };

    const onDiscoveryRooms = (rooms: { code: string; hostName: string }[]) => {
      setDiscoveredRooms(rooms);
    };

    socket.on('room_state', onRoomState);
    socket.on('challenge_start', onChallengeStart);
    socket.on('challenge_result', onChallengeResult);
    socket.on('error', onError);
    socket.on('discovery_rooms', onDiscoveryRooms);

    // Heartbeat every 40s
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat');
    }, 40000);

    // Discovery every 5s
    const discoveryInterval = setInterval(() => {
      socket.emit('discover_rooms');
    }, 5000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_state', onRoomState);
      socket.off('challenge_start', onChallengeStart);
      socket.off('challenge_result', onChallengeResult);
      socket.off('error', onError);
      socket.off('discovery_rooms', onDiscoveryRooms);
      clearInterval(heartbeatInterval);
      clearInterval(discoveryInterval);
    };
  }, []); // Empty dependency array to run only once

  useEffect(() => {
    updatesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.updates]);

  const handleCreateRoom = (mode: GameMode) => {
    console.log('handleCreateRoom called', { playerName, mode, socketId: socket.id });
    if (!playerName) return setError('Digite seu nome primeiro!');
    socket.emit('create_room', { playerName, mode });
  };

  const handleJoinRoom = (code?: string) => {
    const targetCode = code || roomCode;
    if (!playerName || !targetCode) return setError('Preencha nome e código!');
    socket.emit('join_room', { playerName, roomCode: targetCode });
  };

  const handleStartGame = () => {
    if (room) socket.emit('start_game', room.code);
  };

  const handleAttack = (targetId: string) => {
    if (room) socket.emit('attack_player', { roomCode: room.code, targetId });
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (room && challenge) {
      socket.emit('submit_answer', { 
        roomCode: room.code, 
        challengeId: challenge.id, 
        answer 
      });
    }
  };

  const handleQuitChallenge = () => {
    if (room && challenge) {
      socket.emit('quit_challenge', { roomCode: room.code, challengeId: challenge.id });
      setChallenge(null);
    }
  };

  const handleRestart = () => {
    if (room) socket.emit('restart_game', room.code);
  };

  const me = room ? (Object.values(room.players) as Player[]).find(p => p.id === socket.id) : null;
  const otherPlayers = room ? (Object.values(room.players) as Player[]).filter(p => p.id !== socket.id) : [];

  const sortedPlayers = room ? (Object.values(room.players) as Player[]).sort((a, b) => {
    if (a.status === 'FINISHED' && b.status === 'FINISHED') return (a.finishPosition || 0) - (b.finishPosition || 0);
    if (a.status === 'FINISHED') return -1;
    if (b.status === 'FINISHED') return 1;
    if (a.status === 'ELIMINATED' && b.status === 'ELIMINATED') return (b.finishPosition || 0) - (a.finishPosition || 0);
    if (a.status === 'ELIMINATED') return 1;
    if (b.status === 'ELIMINATED') return -1;
    return b.points - a.points;
  }) : [];

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg to-[#020617]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="inline-block p-4 bg-accent/10 rounded-3xl mb-4">
              <Shield className="w-12 h-12 text-accent" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Proteja sua Casa</h1>
            <p className="text-white/40 font-medium">Invasão estratégica em tempo real</p>
            {!isConnected && (
              <div className="text-[10px] font-bold text-danger animate-pulse uppercase tracking-widest">
                Desconectado do servidor...
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Seu Nome</label>
              <input 
                type="text" 
                placeholder="EX: JOGADOR1"
                className="input-field w-full"
                value={playerName}
                onChange={e => setPlayerName(e.target.value.toUpperCase().replace(/\s/g, ''))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Código da Sala</label>
              <input 
                type="text" 
                placeholder="EX: AB1234"
                className="input-field w-full"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              />
            </div>
            <button 
              onClick={() => handleJoinRoom()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-5 h-5" />
              ENTRAR
            </button>
          </div>

          {discoveredRooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 text-center">Salas na sua rede</h3>
              <div className="grid gap-2">
                {discoveredRooms.map(r => (
                  <button 
                    key={r.code}
                    onClick={() => handleJoinRoom(r.code)}
                    className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-all text-left"
                  >
                    <div>
                      <div className="font-bold text-accent">{r.code}</div>
                      <div className="text-xs text-white/40">Host: {r.hostName}</div>
                    </div>
                    <Users className="w-4 h-4 text-white/20" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 pt-4">
            <button 
              onClick={() => handleCreateRoom('PALAVRAS')}
              className={cn(
                "text-sm font-bold transition-all uppercase tracking-widest px-6 py-2 rounded-full",
                playerName ? "text-accent hover:bg-accent/10" : "text-white/10 cursor-not-allowed"
              )}
            >
              Criar uma nova sala
            </button>
            {!playerName && (
              <p className="text-[10px] text-white/20 uppercase tracking-widest">Digite seu nome para criar uma sala</p>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-danger text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold z-50"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (view === 'LOBBY' && room) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Sala de Espera</h2>
            <div className="text-3xl font-black text-accent">{room.code}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-widest text-white/40">Modo</div>
            <div className="font-bold">{room.mode === 'PALAVRAS' ? 'PALAVRAS' : 'PALAVRAS E CONTAS'}</div>
          </div>
        </div>

        <div className="card space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Jogadores ({Object.keys(room.players).length})
            </h3>
            {me?.isHost && (
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCreateRoom(room.mode === 'PALAVRAS' ? 'PALAVRAS_CONTAS' : 'PALAVRAS')}
                  className="p-2 glass rounded-lg hover:bg-white/10"
                  title="Mudar Modo"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {(Object.values(room.players) as Player[]).map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 glass rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", p.id === socket.id ? "bg-accent" : "bg-white/20")} />
                  <span className="font-bold">{p.name}</span>
                  {p.isHost && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-black">HOST</span>}
                </div>
                <span className="text-xs font-bold text-white/20">PRONTO</span>
              </div>
            ))}
          </div>

          {me?.isHost ? (
            <button 
              onClick={handleStartGame}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4"
            >
              <Play className="w-5 h-5" />
              INICIAR PARTIDA
            </button>
          ) : (
            <div className="text-center p-4 glass rounded-xl border-dashed border-white/10">
              <p className="text-sm text-white/40 animate-pulse">Aguardando o host iniciar...</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="text-xs font-bold text-white/20 hover:text-danger transition-all uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
          >
            <LogOut className="w-4 h-4" />
            Sair da Sala
          </button>
        </div>
      </div>
    );
  }

  if (view === 'GAME' && room && me) {
    return (
      <div className="min-h-screen p-4 max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between glass p-4 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-accent/20 p-3 rounded-xl">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Sua Casa</div>
              <div className="text-xl font-black">{me.points} <span className="text-xs text-white/40">PTS</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Sala</div>
            <div className="font-black text-accent">{room.code}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 flex-1">
          {/* Main Area */}
          <div className="lg:col-span-2 space-y-6">
            {challenge ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="card pulse-border bg-accent/5"
              >
                <div className="text-center space-y-8 py-8">
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-accent">Invasão em curso</h3>
                    <div className="text-5xl font-black tracking-tighter">{challenge.question}</div>
                  </div>

                  <form onSubmit={handleSubmitAnswer} className="space-y-4 max-w-xs mx-auto">
                    <input 
                      autoFocus
                      type="text"
                      className="input-field w-full text-center text-2xl font-black"
                      placeholder="RESPOSTA"
                      value={answer}
                      onChange={e => setAnswer(e.target.value.toUpperCase())}
                    />
                    <button type="submit" className="btn-primary w-full py-4">ENVIAR</button>
                  </form>

                  <div className="pt-8">
                    <button 
                      onClick={handleQuitChallenge}
                      className="text-xs font-bold text-white/20 hover:text-danger transition-all uppercase tracking-widest"
                    >
                      Sair da casa (Penalidade: 5 pts)
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40 ml-2">Escolha um alvo para invadir</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {otherPlayers.map(p => (
                    <button 
                      key={p.id}
                      disabled={p.status !== 'PLAYING' || me.status !== 'PLAYING'}
                      onClick={() => handleAttack(p.id)}
                      className={cn(
                        "card p-4 flex items-center justify-between hover:bg-white/5 transition-all group",
                        p.status !== 'PLAYING' && "opacity-50 grayscale cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-white/5 p-2 rounded-lg group-hover:bg-accent/20 transition-all">
                          <Sword className="w-5 h-5 text-white/40 group-hover:text-accent" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold">{p.name}</div>
                          <div className="text-xs text-white/40">{p.points} PTS</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-accent" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Updates */}
            <div className="card h-[400px] flex flex-col p-0 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <History className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-black uppercase tracking-widest">Atualizações</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {room.updates.map(u => (
                  <div key={u.id} className="text-xs leading-relaxed">
                    <span className="text-white/20 mr-2">[{new Date(u.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
                    <span className="text-white/60">{u.message}</span>
                  </div>
                ))}
                <div ref={updatesEndRef} />
              </div>
            </div>

            {/* Ranking Preview */}
            <div className="card p-4 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Ranking</h3>
              <div className="space-y-2">
                {sortedPlayers.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 w-4">{i + 1}.</span>
                      <span className={cn("font-bold", p.id === socket.id && "text-accent")}>{p.name}</span>
                    </div>
                    <span className="font-mono">{p.points}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <button 
            onClick={() => setView('LOBBY')}
            className="text-xs font-bold text-white/20 hover:text-white transition-all uppercase tracking-widest"
          >
            Ver sala de espera
          </button>
          
          {me.isHost && (
            <div className="flex gap-4">
              <button onClick={handleRestart} className="flex items-center gap-2 text-xs font-bold text-white/20 hover:text-accent transition-all uppercase tracking-widest">
                <RefreshCw className="w-4 h-4" /> Reiniciar
              </button>
              <button onClick={() => socket.emit('finish_game', room.code)} className="flex items-center gap-2 text-xs font-bold text-white/20 hover:text-danger transition-all uppercase tracking-widest">
                <LogOut className="w-4 h-4" /> Finalizar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'RANKING' && room) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-block p-6 bg-accent/10 rounded-full">
            <Trophy className="w-16 h-16 text-accent" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Fim de Jogo</h1>
          <p className="text-white/40 font-medium">Resultados da Sala {room.code}</p>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="bg-white/5 p-4 border-b border-white/5 grid grid-cols-4 text-[10px] font-black uppercase tracking-widest text-white/40">
            <div className="col-span-2">Jogador</div>
            <div className="text-center">Pontos</div>
            <div className="text-right">Status</div>
          </div>
          <div className="divide-y divide-white/5">
            {sortedPlayers.map((p, i) => (
              <div key={p.id} className={cn("p-4 grid grid-cols-4 items-center", p.id === socket.id && "bg-accent/5")}>
                <div className="col-span-2 flex items-center gap-3">
                  <span className="text-white/20 font-mono text-sm">{i + 1}.</span>
                  <span className="font-bold">{p.name}</span>
                </div>
                <div className="text-center font-mono font-bold">{p.points}</div>
                <div className="text-right">
                  {p.status === 'FINISHED' ? (
                    <span className="text-[10px] bg-success/20 text-success px-2 py-1 rounded-full font-black">META ATINGIDA</span>
                  ) : p.status === 'ELIMINATED' ? (
                    <span className="text-[10px] bg-danger/20 text-danger px-2 py-1 rounded-full font-black">ELIMINADO</span>
                  ) : (
                    <span className="text-[10px] bg-white/10 text-white/40 px-2 py-1 rounded-full font-black">ATIVO</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {me?.isHost && (
          <button 
            onClick={handleRestart}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4"
          >
            <RefreshCw className="w-5 h-5" />
            REINICIAR JOGO
          </button>
        )}

        <div className="text-center">
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="text-xs font-bold text-white/20 hover:text-danger transition-all uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
          >
            <LogOut className="w-4 h-4" />
            Sair para o Início
          </button>
        </div>
      </div>
    );
  }

  return null;
}