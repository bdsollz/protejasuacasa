export type GameMode = 'PALAVRAS' | 'PALAVRAS_CONTAS';
export type PlayerStatus = 'WAITING' | 'PLAYING' | 'FINISHED' | 'ELIMINATED';

export interface Player {
  id: string;
  name: string;
  points: number;
  status: PlayerStatus;
  reconnectKey: string;
  isHost: boolean;
  finishPosition?: number;
}

export interface Challenge {
  id: string;
  type: 'WORD' | 'MATH';
  question: string;
  answer: string;
  attackerId: string;
  targetId: string;
}

export interface GameUpdate {
  id: string;
  message: string;
  timestamp: number;
}

export interface Room {
  code: string;
  mode: GameMode;
  players: Record<string, Player>;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  updates: GameUpdate[];
  deck: string[];
  usedDeck: string[];
  finishCount: number;
  ipHash: string;
}

export interface ServerToClientEvents {
  room_state: (room: Room) => void;
  challenge_start: (challenge: Challenge) => void;
  challenge_result: (result: { success: boolean; message: string; pointsGained: number }) => void;
  error: (message: string) => void;
  discovery_rooms: (rooms: { code: string; hostName: string }[]) => void;
}

export interface ClientToServerEvents {
  create_room: (data: { playerName: string; mode: GameMode }) => void;
  join_room: (data: { playerName: string; roomCode: string; reconnectKey?: string }) => void;
  start_game: (roomCode: string) => void;
  attack_player: (data: { roomCode: string; targetId: string }) => void;
  submit_answer: (data: { roomCode: string; challengeId: string; answer: string }) => void;
  quit_challenge: (data: { roomCode: string; challengeId: string }) => void;
  restart_game: (roomCode: string) => void;
  heartbeat: () => void;
  discover_rooms: () => void;
}