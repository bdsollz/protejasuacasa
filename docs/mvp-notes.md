# Decisões de MVP

## O que entrou

- Apenas ação `Invadir` por rodada
- 1 invasão por jogador por rodada
- Anti-trapaça no servidor (desafio, timer, validação)
- Escudo aplicado à casa invadida
- Anti-perseguição: bloqueio de alvo repetido em rodada consecutiva

## O que ficou para próxima versão

- Eventos globais a cada 3 rodadas
- Modo Fantasma com interação
- Modos extras: Defender, Recuperar, Espionar
- Mais tipos de desafio além de palavra lacunada
- Reconexão robusta com `playerId` persistente

## Regras importantes implementadas

- Roubo final = `min(tetoFixo, tetoPercentualDoAlvo, valorBaseComPerformance)`
- Falha transfere custo ao alvo, mas custo é capado para manter atacante com no mínimo 1 ponto
