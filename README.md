# Proteja sua Casa

Jogo web realtime para celular com salas, ataques e desafios.

## Rodar local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy

### Cloudflare Pages
- Build command: `npm run build:web`
- Output directory: `public`
- Env var: `SOCKET_SERVER_URL=https://SEU_BACKEND.onrender.com`

### Render (backend)
- Start command: `npm start`
- Env var: `CORS_ORIGIN=https://SEU_SITE.pages.dev`

## Testes

```bash
npm test
```
