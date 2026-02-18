# Belako Fan Platform (Monorepo)

Production-oriented monorepo for the Belako fan ecosystem:
- **Fan App** (mobile-first web app)
- **Backend API** (auth, catalog, commerce, dashboard data)
- **Band Dashboard** (CMS and operations panel)

This README is focused on **developer onboarding + operations**.

## 1) Project Overview

This repository contains three runnable apps that work together:

- Fan app (`.`)
  - React + Vite frontend for fans (onboarding, home, concerts, store, rewards, profile).
- Backend API (`./backend`)
  - Node.js + Express + Prisma + PostgreSQL.
  - Source of truth for auth, content catalog, commerce and dashboard CRUD.
- Dashboard (`./dashboard`)
  - React + Vite admin panel for band operations (store items, concerts, lives, rewards, sales/users).

High-level data flow:
- Fan App and Dashboard call Backend API.
- Backend reads/writes PostgreSQL via Prisma.
- Stripe and Google SSO are integrated through backend routes.

## 2) Architecture

### Runtime map
- **Fan App**: React + Vite
- **Dashboard**: React + Vite
- **Backend**: Express + Prisma + Postgres

### Active backend API surface
- `/auth/*`
- `/catalog/*`
- `/commerce/*`
- `/dashboard/*`

### Health/ops endpoints
- `/health` (liveness)
- `/ready` (DB readiness)

Note: Non-mounted legacy surfaces were removed from active routing and are not part of the current runtime contract.

## 3) Repository Structure

```text
fidelity-app/
  src/                      # Fan app source
  backend/
    src/                    # API source
    prisma/                 # Prisma schema + seed
    scripts/                # Maintenance scripts
  dashboard/
    src/                    # Dashboard source
  .github/workflows/        # CI + Pages workflows
  scripts/                  # Frontend quality scripts
  docs/                     # Additional docs
```

## 4) Prerequisites

- **Node.js**: 20+ (CI runs on Node 20)
- **npm**: 10+
- **PostgreSQL**: required for backend
- Optional: **Docker** for local infrastructure

## 5) Environment Variables

## Fan App (`./.env`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `http://localhost:4000` | API base URL used by frontend |
| `VITE_GOOGLE_CLIENT_ID` | Yes | `123...apps.googleusercontent.com` | Google GIS client ID |

## Dashboard (`./dashboard/.env`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `http://localhost:4000` | API base URL used by dashboard |
| `VITE_GOOGLE_CLIENT_ID` | Yes | `123...apps.googleusercontent.com` | Google GIS client ID |

## Backend (`./backend/.env`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `PORT` | No | `4000` | API port (defaults to 4000) |
| `DATABASE_URL` | Yes | `postgresql://user:pass@localhost:5432/fidelity` | Prisma DB connection |
| `JWT_SECRET` | Yes | `replace-with-strong-random-secret` | JWT signing key |
| `GOOGLE_CLIENT_ID` | Yes | `123...apps.googleusercontent.com` | Must match FE client ID |
| `STRIPE_SECRET_KEY` | Yes (commerce) | `your_stripe_secret_key` | Server-side Stripe key |
| `STRIPE_PUBLISHABLE_KEY` | Yes (commerce) | `your_stripe_publishable_key` | Returned to frontend config route |
| `YOUTUBE_API_KEY` | Optional | `AIza...` | Enables `/catalog/videos` |
| `YOUTUBE_CHANNEL_HANDLE` | Optional | `@Belako` | Defaults to `@Belako` |
| `CLIENT_URL` | Optional | `http://localhost:5173` | Legacy compatibility var |
| `CORS_ALLOWED_ORIGINS` | Recommended | `http://localhost:5173,http://localhost:5174,https://app.yourdomain.com,https://dashboard.yourdomain.com` | Extra allowed origins |
| `BAND_ALLOWED_EMAILS` | Optional | `owner@yourdomain.com,manager@yourdomain.com` | Comma-separated dashboard allowlist |
| `ALLOW_ALL_DASHBOARD_EMAILS` | Optional | `true` / `false` | Set `true` for open access |

### Minimal backend example

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fidelity
JWT_SECRET=replace-with-strong-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

## 6) Local Development

Start services in this order:

### 1) Backend

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

### 2) Fan App

```bash
cd .
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### 3) Dashboard

```bash
cd dashboard
npm install
npm run dev -- --host 0.0.0.0 --port 5174
```

### Expected local URLs
- Fan App: `http://localhost:5173`
- Dashboard: `http://localhost:5174`
- Backend: `http://localhost:4000`

### Quick health checks

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

## 7) Database & Prisma

First-time backend setup:

```bash
cd backend
npm run db:generate
npm run db:push
npm run db:seed
```

Useful scripts:

```bash
npm run db:backfill:tier-progress
npm run stripe:backfill:sales
npm run users:migrate
```

### Common `DATABASE_URL` pitfall
If you run locally, do **not** use an internal Railway hostname like `postgres.railway.internal` from your laptop. Use either:
- local Postgres URL (`localhost:5432`), or
- Railway **public** connection string.

## 8) Build & Quality Checks

### Frontend

```bash
cd .
npm run build
node scripts/check-frontend-budget.mjs
```

### Backend

```bash
cd backend
npm run build
node scripts/check-startup-sanity.mjs
```

Pass criteria:
- TypeScript builds succeed.
- Budget and startup sanity scripts pass.

## 9) Deployment

## Fan App (GitHub Pages)
- Build from `main` via `.github/workflows/pages.yml`.
- Artifact: `dist/`.
- Custom domain: `app.yourdomain.com`.

Manual alternative:

```bash
cd .
npm run deploy:branch
```

## Backend (Railway)
- Service root: `backend/`
- Start command: `npm run start` (or `node dist/index.js`)
- Required env vars: see backend table above.
- Ensure `/health` and `/ready` return 200 in production.

## Dashboard (Cloudflare)
- Project root/path: `dashboard/`
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Custom domain (example): `dashboard.yourdomain.com`

## 10) CI/CD Notes

Workflows:
- CI: `./.github/workflows/ci.yml`
- Pages deploy: `./.github/workflows/pages.yml`

Secrets in GitHub Actions:
- `VITE_GOOGLE_CLIENT_ID` is required by frontend/page builds.

Rollup optional dependency note:
- Linux builds can fail with missing `@rollup/rollup-linux-x64-gnu` due to npm optional-deps behavior.
- If this happens, rerun install with optional deps and/or explicitly install the package before build.

## 11) Troubleshooting

## `localhost:4000` called from production domain
Symptom: CORS/Private Network errors in browser.

Fix:
- Set `VITE_API_BASE_URL=https://api.yourdomain.com` in production build.
- Redeploy frontend.

## Google SSO origin mismatch
Symptom: `The given origin is not allowed for the given client ID`.

Fix:
- In Google Cloud Console, add all exact origins:
  - `http://localhost:5173`
  - `http://localhost:5174`
  - `https://app.yourdomain.com`
  - `https://dashboard.yourdomain.com`
- Ensure same `GOOGLE_CLIENT_ID` in backend and both frontends.

## Missing Rollup Linux binary in CI
Symptom: `Cannot find module '@rollup/rollup-linux-x64-gnu'`.

Fix:
- Use `npm ci --include=optional`, or
- run `npm i --no-save @rollup/rollup-linux-x64-gnu@<rollup-version>` before build.

## Prisma client init/generate errors
Symptom: `@prisma/client did not initialize yet`.

Fix:

```bash
cd backend
npm run db:generate
npm run build
```

## Port already in use (`EADDRINUSE`)

```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:5174 -sTCP:LISTEN
kill <PID>
```

## Blank page after deploy
- Hard refresh (`Cmd+Shift+R`).
- Verify latest GitHub Pages artifact and domain DNS/certificate status.

## 12) Security Notes

- Never expose backend secrets (`JWT_SECRET`, `STRIPE_SECRET_KEY`, DB creds) in frontend.
- `STRIPE_PUBLISHABLE_KEY` is safe for frontend; `STRIPE_SECRET_KEY` is backend-only.
- Use a strong random JWT secret in every non-local environment.
- Restrict CORS and dashboard access settings in production.

## 13) Current Product Scope

- Google auth + onboarding
- Fan app tabs: Home/Concerts/Store/Rewards/Profile
- Dashboard CRUD: store items, concerts, lives, rewards and config
- Sales and registration visibility in dashboard
- Stripe checkout + invoice retrieval paths

## 14) Roadmap / Next Steps (Optional)

- Split docs into `/docs/` playbooks (runbook, deployment, incidents).
- Add automated smoke tests against `/health`, `/ready`, and key catalog endpoints.
- Add release checklist for Pages + Railway + Cloudflare.
