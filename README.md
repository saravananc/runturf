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
| `apps/api` | Express 5 + TypeScript + Drizzle ORM + PostgreSQL/PostGIS backend |
| `apps/web` | React + Vite + MapLibre GL web app (PWA) |
| `apps/mobile` | Expo (React Native) mobile scaffold |
| `docker-compose.yml` | PostGIS 16 database |

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

## Tests

```bash
npm test          # all workspaces
```

## MVP scope

Epics covered: Foundation, Auth, GPS/Maps, Runs, Territory (core), Challenges (core),
Rewards. Deferred: Social graph/feed, Clubs & battles, push notifications, background
mobile tracking, GPX import/export, offline maps, store release.
