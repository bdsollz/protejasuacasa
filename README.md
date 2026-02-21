# Casas e Saque de Pontos (MVP)

MVP jogável no navegador mobile com salas em tempo real.

## Stack

- Node.js
- Express
- Socket.IO
- Frontend HTML/CSS/JS (mobile-first)

## Rodando o projeto

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` em dois celulares (ou duas abas) para testar.

## Deploy com GitHub + Netlify

Importante: o Netlify vai hospedar o frontend. O backend Socket.IO precisa rodar em outro serviço (Render/Railway/Fly/VM).

### 1) Subir no GitHub

```bash
git init
git add .
git commit -m "MVP do jogo + config Netlify"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

### 2) Publicar backend (Socket.IO)

Use o mesmo repositório em um serviço Node.js e configure:

- Start command: `npm start`
- Variável `CORS_ORIGIN`: URL do seu site Netlify (ex: `https://meu-jogo.netlify.app`)

Quando subir, copie a URL pública do backend (ex: `https://meu-backend.onrender.com`).

### 3) Publicar frontend no Netlify

No Netlify:

- Add new site -> Import from Git
- Escolha o repositório
- Build command: `npm run build:web`
- Publish directory: `public`
- Environment variable: `SOCKET_SERVER_URL` = URL do backend publicado

Depois do deploy, abra a URL do Netlify e teste.

## Fluxo do MVP implementado

- Criar sala e entrar por código
- Lobby com jogadores conectados
- Início da partida pelo host
- Rodadas sincronizadas com fases:
  - Planejamento
  - Desafio
  - Resultado
- Invasão com palavra lacunada
- Regras de roubo com teto fixo + teto percentual
- Penalidade por falha com proteção para não zerar por custo
- Escudo pós-invasão por rodada
- Vitória por meta de pontos ou último vivo

## Estrutura

- `src/server.js`: servidor realtime e orquestração de fases
- `src/gameEngine.js`: regras de jogo (fonte da verdade)
- `src/config.js`: parâmetros default
- `src/challenges.js`: banco simples de palavras
- `public/`: interface web mobile
- `test/gameEngine.test.js`: testes das regras centrais
- `scripts/build-web.mjs`: gera `public/config.js` com `SOCKET_SERVER_URL`
- `netlify.toml`: configuração de build/publicação do Netlify
