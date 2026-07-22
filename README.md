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
| `apps/mobile` | Expo (React Native) mobile scaffold |
| `docker-compose.yml` | PostgreSQL 16 database (host port 5433) |

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

Scan the QR code with **Expo Go** on your phone. Login, live run recording with
route polyline, and the territory overlay all hit the same API as the web app.

## Tests & checks

```bash
npm test          # unit + API integration tests (needs the database up)
npm run typecheck # all workspaces
npm run lint      # eslint
```

## MVP scope

Epics covered: Foundation, Auth, GPS/Maps, Runs, Territory (core), Challenges (core),
Rewards. Deferred: Social graph/feed, Clubs & battles, push notifications, background
mobile tracking, GPX import/export, offline maps, store release.
