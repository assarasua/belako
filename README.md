# Fidelity MVP

## Frontend (mobile-first web app)

```bash
cd /Users/axi/Documents/fidelity-app
npm install
npm run dev
```

## Backend API

```bash
cd /Users/axi/Documents/fidelity-app/backend
cp .env.example .env
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

## Docker (backend + postgres)

```bash
cd /Users/axi/Documents/fidelity-app/infra
docker compose up --build
```

## Implemented areas
- Fan flow: onboarding, discovery/live, bids, rewards, wallet, token-gated store.
- Artist flow: onboarding, go-live setup/controls, moderation, dashboards.
- API scaffold: auth, loyalty, commerce, wallet/NFT, analytics.
- Realtime scaffold: websocket chat channel.
- Data model scaffold: Prisma schema for core entities.
