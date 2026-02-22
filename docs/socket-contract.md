# Socket Contract - Proteja sua Casa

Este documento padroniza os eventos em tempo real entre cliente e servidor.

## Entidades

### Player
- `id: string`
- `name: string`
- `isHost: boolean`
- `connected: boolean`
- `status: "active" | "finished" | "eliminated"`
- `points: number`
- `position: number | null`
- `stolenTotal: number`
- `attacksCount: number`

### Room
- `code: string`
- `status: "waiting" | "playing" | "finished"`
- `mode: "Palavras" | "Palavras e Contas"`
- `targetGoal: number`
- `players: Player[]`
- `history: string[]`
- `ranking: RankingRow[]`
- `attackRanking: AttackRankingRow[]`

### RankingRow
- `position: number`
- `outOf: number`
- `id: string`
- `name: string`
- `status: string`
- `points: number`
- `attacksCount: number`
- `stolenTotal: number`

### AttackRankingRow
- `id: string`
- `name: string`
- `attacksCount: number`
- `stolenTotal: number`

## Cliente -> Servidor

### `createRoom`
Cria sala e adiciona o host.

Payload:
```json
{ "playerName": "BRUNO" }
```

### `joinRoom`
Entra em uma sala existente.

Payload:
```json
{ "roomCode": "AB12CD", "playerName": "BRUNO" }
```

### `reconnectRoom`
Reconecta jogador após refresh.

Payload:
```json
{ "roomCode": "AB12CD", "playerId": "P123", "reconnectKey": "..." }
```

### `findRooms`
Solicita salas ativas na mesma rede.

Payload: sem payload.

### `startGame`
Host inicia partida.

Payload:
```json
{ "roomCode": "AB12CD", "mode": "Palavras" }
```

### `finishGame`
Host finaliza partida e envia todos para ranking.

Payload:
```json
{ "roomCode": "AB12CD" }
```

### `attack`
Inicia desafio para pegar pontos.

Payload:
```json
{ "roomCode": "AB12CD", "attackerId": "P1", "targetId": "P2" }
```

### `submitAnswer`
Envia resposta do desafio.

Payload:
```json
{ "roomCode": "AB12CD", "playerId": "P1", "answer": "ACUCAR" }
```

### `quitChallenge`
Sai da casa durante o desafio e recebe penalidade.

Payload:
```json
{ "roomCode": "AB12CD", "playerId": "P1" }
```

### `getMyReport`
Solicita relatório individual no ranking.

Payload:
```json
{ "roomCode": "AB12CD", "playerId": "P1" }
```

### `restartGame`
Host reinicia para sala de espera.

Payload:
```json
{ "roomCode": "AB12CD" }
```

### `keepalive:ping`
Heartbeat a cada 40s no cliente.

Payload: sem payload.

## Servidor -> Cliente

### `joined`
Confirma entrada/reconexão.

Payload:
```json
{ "roomCode": "AB12CD", "playerId": "P1", "reconnectKey": "..." }
```

### `roomUpdate`
Snapshot completo da sala.

Payload: `Room`.

### `roomsNearby`
Lista de salas ativas na mesma rede.

Payload:
```json
[
  { "code": "AB12CD", "mode": "Palavras", "players": 4, "connected": 4 }
]
```

### `gameStarted`
Confirma início da partida.

Payload: sem payload.

### `challenge`
Entrega desafio ao atacante.

Payload:
```json
{
  "targetId": "P2",
  "targetName": "ALVO",
  "text": "A _ U _ A R",
  "hint": "Dica...",
  "answerType": "text"
}
```

### `challengeResult`
Resultado imediato do desafio enviado para quem respondeu.

Payload:
```json
{
  "success": true,
  "amount": 10,
  "message": "Voce pegou +10 pontos de ALVO",
  "ranking": []
}
```

### `playerState`
Mudança de estado individual (eliminado/finalizou).

Payload:
```json
{
  "type": "finished",
  "playerId": "P1",
  "position": 1,
  "outOf": 6,
  "ranking": [],
  "losses": [],
  "attackRanking": []
}
```

### `myReport`
Relatório individual de perdas + ranking de ataques.

Payload:
```json
{
  "losses": [
    { "attackerId": "P2", "attackerName": "JOAO", "amount": 30 }
  ],
  "attackRanking": [],
  "ranking": []
}
```

### `gameFinished`
Encerramento global da partida.

Payload: `Room`.

### `gameReset`
Partida reiniciada para sala de espera.

Payload: sem payload.

### `keepalive:pong`
Resposta ao heartbeat do cliente.

Payload:
```json
{ "ts": 1730000000000 }
```

### `actionError`
Erro de validação de regra.

Payload: `string`.

### `reconnectFailed`
Falha de reconexão com sessão antiga.

Payload: sem payload.

## Regras de consistencia
- Nome e codigo devem ser enviados em maiusculo sem espacos.
- Saque por ataque correto: fixo em `10` (ou menos, se alvo tiver menos que 10).
- Cliente nao deve decidir regras de negocio; servidor valida tudo.
- `roomUpdate` e a fonte principal de verdade para renderizacao.

## Ajustes de conexao recomendados
- `SOCKET_PING_INTERVAL=25000`
- `SOCKET_PING_TIMEOUT=60000`

Esses valores ja sao padrao no servidor atual e podem ser sobrescritos por variavel de ambiente.
