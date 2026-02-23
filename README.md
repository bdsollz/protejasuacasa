# Proteja sua Casa - Web UI (React)

Projeto web em React + Vite + TypeScript com design minimalista premium, tokens de tema (escuro/claro), componentes acessíveis, animações discretas e suíte de testes.

## Stack
- React + Vite + TypeScript
- TailwindCSS com CSS Variables
- Framer Motion
- Lottie fallback via `lottie-web` (placeholder em `src/assets/lottie/loader.json`)
- Vitest + React Testing Library
- Playwright + axe-core (smoke a11y)
- ESLint + Prettier

## Como rodar
```bash
npm install
npm run dev
```

## Deploy Cloudflare Pages (definitivo)
- O projeto inclui `wrangler.toml` com `pages_build_output_dir = "dist"`.
- Build command recomendado: `npm run build:web` (ou `npm run build`).
- Output directory: `dist`.
- O arquivo `public/_headers` evita cache agressivo de HTML (previne frontend antigo).
- O arquivo `public/_redirects` habilita fallback SPA (`/* -> /index.html`).

Build e preview:
```bash
npm run build
npm run preview
```

Type check (opcional no deploy):
```bash
npm run typecheck
```

No deploy (Cloudflare/Render), o build usa `vite build` para evitar falhas por arquivos de tooling (Playwright/Vitest).

## Scripts
- `npm run dev`: sobe ambiente de desenvolvimento
- `npm run build`: valida TypeScript e gera build de produção
- `npm run preview`: serve build local
- `npm run test`: testes unit/component (Vitest)
- `npm run test:e2e`: smoke e2e (Playwright)
- `npm run test:a11y`: varredura básica com axe-core
- `npm run lint`: lint TS/TSX
- `npm run format`: formatação com Prettier
- `npm run mockups`: captura PNGs automáticos em `/mockups`

## Estrutura
```text
src/
  app/
    layout/
    routes/
  components/
    ui/
  styles/
    tokens.json
    tokens.css
  assets/
    icons/
    illustrations/
    backgrounds/
    lottie/
  lib/
  tests/
scripts/
mockups/
tests/e2e/
```

## Design tokens e paleta
Tokens centrais:
- `/Users/brunooliver/Documents/Game/src/styles/tokens.json`
- `/Users/brunooliver/Documents/Game/src/styles/tokens.css`

Tema padrão: escuro. Tema claro via `data-theme="light"`.

### Como trocar paleta
1. Atualize valores em `src/styles/tokens.json`.
2. Espelhe em `src/styles/tokens.css` para dark/light.
3. Reutilize apenas variáveis (`--color-*`, `--gradient-*`) nos componentes.

## Componentes UI
Componentes em `/Users/brunooliver/Documents/Game/src/components/ui`:
- Button
- Card
- ListItem
- Modal
- TextField
- Toast

Cada componente possui arquivo de especificação `.spec.json` com estados/tokens/tamanhos.

## Acessibilidade
- Contraste focado em WCAG AA
- Foco visível (`.focus-ring`)
- Navegação por teclado validada em e2e
- Modal com `aria-modal`, ESC, clique no overlay e trap de foco
- `aria-invalid` e `aria-describedby` em inputs
- `prefers-reduced-motion` + override manual em `/settings`

## Performance
- Rotas lazy (`React.lazy + Suspense`)
- Animações em `transform/opacity`
- `content-visibility: auto` para listas longas (`.cv-auto`)
- Assets locais leves (SVG)

### Pipeline de imagem (WebP/AVIF)
Este projeto já usa SVG local e `loading="lazy"` quando aplicável.
Para WebP/AVIF em produção, adicione etapa de otimização no CI (ex.: `sharp`) para gerar variações e referenciar `<picture>` nos componentes de mídia.

## Lottie
- Em uso: fallback com `lottie-web` em `src/components/LottieBadge.tsx`
- Placeholder: `src/assets/lottie/loader.json`

Para usar `.lottie` real com `@lottiefiles/dotlottie-react`:
1. Coloque `loader.lottie` em `src/assets/lottie/`
2. Troque o componente fallback para `DotLottieReact`
3. Remova o JSON placeholder se não for necessário

## Mockups automáticos
Script: `/Users/brunooliver/Documents/Game/scripts/render-mockups.ts`

Gera screenshots de:
- `/components` e `/`
- 1440x900 e 390x844
- Saída: `/Users/brunooliver/Documents/Game/mockups/*.png`

## Jogo em produção
- A rota `/` abre diretamente o jogo (entrar/criar sala/sala de espera/partida/ranking).
- O frontend conecta no backend Socket.IO usando `VITE_SOCKET_URL`.
- Exemplo para Cloudflare Pages:
  - `VITE_SOCKET_URL=https://proteja-sua-casa.onrender.com`
- Se `VITE_SOCKET_URL` não estiver definido, o frontend usa esse mesmo endpoint como fallback.

## Notas rápidas para React Native e Flutter
- React Native:
  - Replique tokens em objeto TS (`colors`, `spacing`, `radius`, `typography`)
  - Substitua Tailwind utilitário por `StyleSheet` ou NativeWind
  - Modal/Toast devem usar componentes nativos com foco em acessibilidade móvel
- Flutter:
  - Converta tokens para `ThemeData` (`ColorScheme`, `TextTheme`, `ShapeBorder`)
  - Use `go_router` para navegação equivalente
  - Reimplemente motion com `AnimatedOpacity/AnimatedContainer` e respeito a `MediaQuery.disableAnimations`
