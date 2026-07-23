# RunTurf 🏃🗺️

A gamified territory-capture running app: record GPS runs and claim map territory.
The world is divided into a grid of ~150 m cells — every cell your route passes
through becomes yours (and can be stolen back). Earn XP, levels, coins, streaks,
achievements, and compete on leaderboards and weekly challenges.

Built from the product backlog in [`backlog/`](backlog/) (11 Excel files, 10 epics).

## Structure

| Path | What |
|---|---|
| `packages/shared` | TypeScript grid math (slippy-tile territory cells), XP/level economy, API types |
| `apps/api` | Express 5 + TypeScript + Drizzle ORM + PostgreSQL backend |
| `apps/web` | React + Vite + MapLibre GL web app (PWA) |
| `apps/mobile` | Expo (React Native) app — full feature parity with web |
| `apps/api/Dockerfile` | Production image for the API |
| `docker-compose.yml` | PostgreSQL 16 database (host port 5433) + optional API service |

## Getting started

```bash
# 1. Database (requires Docker Desktop running)
docker compose up -d

# 2. Install
npm install

# 3. Migrate + seed
npm run db:migrate
npm run db:seed

# 4. Run (two terminals)
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```

Sign in with a seeded demo account (`demo` / `demo1234`) or register.
On desktop, use the **Simulate** button on the Record screen to replay a
realistic route without leaving your chair.

## Mobile (Expo)

`apps/mobile` is a standalone Expo app (own `node_modules`, not an npm workspace):

```bash
cd apps/mobile
npm install
# Point the app at your machine's LAN IP so your phone can reach the API:
#   set EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000   (defaults to the Android-emulator host 10.0.2.2)
npx expo start
```

Scan the QR code with **Expo Go** on your phone. The mobile app has the same
screens as web — map, record (with pause), history, leaderboard, profile with
editing, challenges, and social (feed / friends / clubs) — all hitting the same API.

## Tests & checks

```bash
npm test          # 96 tests: shared unit + API integration + web (needs the DB up)
npm run typecheck # all workspaces
npm run lint      # eslint
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, migrate, seed, and tests
against a Postgres service, plus a separate job that typechecks and bundles the
mobile app for Android and iOS.

## Deployment

The API ships as a container. Build from the repo root (the monorepo workspace
graph must be in the build context):

```bash
docker build -f apps/api/Dockerfile -t runturf-api .
```

Or run the whole stack (DB + API) with the `app` compose profile:

```bash
docker compose --profile app up --build
```

**Required environment** for a real deployment (see [`apps/api/.env.example`](apps/api/.env.example)):

| Var | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | ≥16 chars; use a strong random value (`openssl rand -base64 48`) |
| `CORS_ORIGIN` | Comma-separated allowed web origins |
| `NODE_ENV=production` | Disables demo seeding, enables `trust proxy`, concise logs |

Run migrations and reference-data seeding as a one-off release step (these need
the dev tooling, so run them from a full `npm ci` checkout pointed at the prod DB):

```bash
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run db:seed   # seeds achievements + challenges; skips demo accounts
```

The image runs as a non-root user and exposes a `/health` endpoint (wired to a
Docker `HEALTHCHECK`). Demo accounts (`demo`/`rival`, password `demo1234`) are
**never** seeded when `NODE_ENV=production` unless `SEED_DEMO=true` is set.

## Scope

Implemented: Foundation, Auth, GPS/Maps, Runs (+ GPX export), Territory, Challenges,
Rewards, Social (feed / friends / clubs with chat), on both web and mobile.
Not yet built: push notifications, background mobile tracking, offline maps,
GPX import, coin shop, club invites/moderation, app-store release.
