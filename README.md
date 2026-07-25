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
npm test          # shared unit + API integration + web (needs the DB up)
npm run typecheck # all workspaces
npm run lint      # eslint
```

Mobile has its own runner (it is not a workspace):

```bash
cd apps/mobile
npm test          # jest-expo + React Native Testing Library
```

### Device tests (Detox, Android)

The jest suite mocks the native layer, so it cannot prove the app boots on a
device, that AsyncStorage really persists across a restart, or that
`react-native-maps` / `expo-location` load at all. Detox covers that by driving
a real build on an emulator.

Needs the JDK, the Android SDK, and a **4 KB-page emulator** (API level ≤ 35, or
any image without the `page_size_16kb` tag). On a 16 KB-page image the system
shows a compatibility dialog — RN 0.76's prebuilt `.so` libs aren't 16 KB
aligned — and that dialog steals window focus, so every Detox interaction times
out. Point `DETOX_AVD_NAME` at your AVD if it isn't called `Medium_Phone`.
**The API must be running** — the app reaches the host at `10.0.2.2:4000` from
the emulator — and the demo account must be seeded (`SEED_DEMO=true npm run db:seed`).

```bash
cd apps/mobile
npm run e2e:prebuild   # generate ./android from app.json (not committed)
# boot a 4 KB-page emulator first, e.g.  emulator -avd <name>
npm run e2e:build      # assemble the release app + androidTest APKs
DETOX_AVD_NAME=<name> npm run e2e   # run the specs on the emulator
```

The default configuration is **release** (JS bundled in, no Metro) — the
reliable path for E2E. `e2e:build:debug` / `e2e:debug` use a debug build instead,
which needs `npx expo start` running for the Metro bundle. The specs disable
Detox synchronization around the map screens (react-native-maps never reports
"idle") and poll with `waitFor`.

iOS configurations are deliberately absent: building them needs Xcode, so they
cannot run on Windows or on a Linux CI runner. Add them alongside the Android
ones when a macOS runner is available.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, migrate, seed, and tests
against a Postgres service; a `mobile` job typechecks, unit-tests and bundles
for Android and iOS; and a separate `mobile-e2e` job runs Detox on an emulator
against a live API.

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
