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
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Backend runs on `http://localhost:4000`.

## Band Dashboard

```bash
cd /Users/axi/Documents/fidelity-app/dashboard
npm install
npm run dev
```

Dashboard expects:
- `VITE_API_BASE_URL=http://localhost:4000`
- `VITE_GOOGLE_CLIENT_ID=<google_client_id>`

## Docker (backend + postgres)

```bash
cd /Users/axi/Documents/fidelity-app/infra
docker compose up --build
```

## Implemented areas
- Fan flow: onboarding, discovery/live, concerts, store, rewards journey.
- Band flow: dashboard CMS for store/concerts/lives/rewards.
- API scaffold: auth, catalog, dashboard CMS, loyalty, commerce, wallet/NFT, analytics.
- Realtime scaffold: websocket chat channel.
- Data model scaffold: Prisma schema for core entities.
