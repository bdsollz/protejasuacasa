# Referencia obrigatoria de design

A partir deste ponto, toda evolucao de UI/UX do jogo **Proteja sua Casa** deve considerar simultaneamente:

- `src/index.css`
- `src/App.tsx`

## Regra principal
Nao usar apenas uma referencia isolada.

## Papel de cada arquivo

### `src/index.css` (identidade visual)
Fonte central de:
- paleta de cores
- tipografia
- contraste
- estilo glassmorphism
- bordas e espacamentos
- estados visuais de componentes

Qualquer tela nova deve respeitar as variaveis e o padrao visual desse arquivo para manter unidade estetica.

### `src/App.tsx` (experiencia e comportamento)
Fonte central de:
- hierarquia do layout
- fluxo entre telas
- transicoes de estado
- feedback visual de acao
- cadencia de atualizacoes e sensacao de tempo real

Qualquer ajuste de interface deve preservar essa logica de navegacao e resposta ao jogador.

## Criterio de aceite para mudancas visuais
Uma mudanca so deve ser considerada concluida quando:
1. estiver alinhada com o estilo definido em `src/index.css`;
2. estiver coerente com o fluxo e comportamento definidos em `src/App.tsx`;
3. nao degradar clareza de feedback em acoes criticas (entrar sala, criar sala, iniciar partida, ataque e ranking).

## Prioridade funcional
Fluxos criticos (ex.: `Criar nova sala`) tem prioridade sobre ajustes cosmeticos.
