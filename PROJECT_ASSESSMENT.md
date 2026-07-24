# RunTurf — Project Assessment

> Evidence-based codebase review. Every finding cites the file(s) it was verified in.
> Generated against commit `32ae0bf` (branch `main`).
>
> ## ⚠️ Status update — the entire prioritized roadmap is complete
>
> This report describes the codebase **as of `32ae0bf`**. Everything below is
> retained as the historical record; the current status is summarised here.
>
> ### Roadmap (all 7 items addressed)
>
> | Roadmap item | Status | Commit |
> |---|---|---|
> | 1. Production hardening (logout revocation, helmet, rate limiting, token cleanup) | ✅ Done | `35f726e` |
> | 2. Pause-clock and backdated-streak bugs (Bugs #1, #2) | ✅ Done | `08608d5` |
> | 3. Weekly challenge lifecycle | ✅ Done | `600dbd3` |
> | 4. Profile editing UI + `pino-http` wiring | ✅ Done | `5687af1` |
> | Tech debt: PostGIS → plain Postgres; week helper extracted to shared | ✅ Done | `cfc951c` |
> | 4.5 Mobile feature parity + mobile in CI | ✅ Done | `d9fb077` |
> | 5. Web test coverage (Vitest + RTL) | ✅ Done | `cace6af` |
> | 6. Deployment (API Dockerfile, prod-safe seed, compose profile, docs) | ✅ Done | `0979d83` |
> | 7a. Coin shop (XP Boost, Streak Freeze) | ✅ Done | `298e886` |
> | 7b. Club invites + owner moderation | ✅ Done | `1d59aab` |
> | 8. GPX import (parser, API, web + mobile UI) | ✅ Done | `121f903` |
> | 9. Minor cleanups (bbox validation, capture over-fetch, PB query, dead endpoint) | ✅ Done | `33388a6` |
> | 10. rAF-independent animated values + mobile screen tests | ✅ Done | `e9e4527` |
> | 11. Mobile screen tests for the remaining seven screens | ✅ Done | `06e86a1` |
> | 12. Mobile API-client tests (session, refresh rotation, revocation) | ✅ Done | `467e39b` |
>
> **Test count: 55 → 213** (39 shared + 73 API + 26 web + 75 mobile), plus a
> mobile CI job (typecheck, expo-doctor, jest, dual-platform bundle).
> All 9 mobile screens and the API client now have runtime coverage.
>
> ### Still open
>
> **Not started (net-new features, none blocking):**
> push notifications · background GPS tracking · offline maps · geofence ·
> saved/reusable routes · club events / scheduled battles ·
> social sharing & privacy settings · analytics · crash reporting · app-store release.
> *(Push and background tracking need a custom Expo dev-client, not Expo Go.)*
>
> **Known-but-unfixed minor items** (from the findings below):
> - Risk #4 — tokens still in `localStorage`; **mitigated** (logout revocation,
>   15-min access token, helmet CSP) but not eliminated. Inherent SPA tradeoff.
> - Time logic remains UTC-only (streaks, weekly windows).
> - Native modules are mocked, so there is no device/emulator run in CI — real
>   GPS, the document-picker UI and map rendering stay unexercised. Closing that
>   needs an EAS Build plus Detox or Maestro.
> - Global `users.role` (site admin) still unenforced — club-level roles
>   (owner/member) *are* enforced via `requireOwner` since `1d59aab`.
>
> **Note on scope:** the backlog's 405 task names are placeholders (e.g. "Login Task 1"),
> so "intended architecture" is inferred from the epic/feature names plus the agreed build
> plan. Completion is reported against **two yardsticks** because a single number would mislead.

---

## Executive Summary

RunTurf is a **functional, cohesively engineered application**, not a scaffold. The core game
loop (auth → GPS run → territory capture → XP/achievements/leaderboard) works end-to-end on the
web with a real transactional backend, tested at the unit and API-integration layers
(55 passing tests). Code quality is high: strict TypeScript, zod-validated inputs everywhere,
centralized error handling, shared FE/BE types, and **no TODOs, mocks, commented-out code, or
hardcoded API responses** in `apps/*/src` or `packages/*/src`.

The gaps are mostly **breadth**, not brokenness: the mobile app is a thin slice of the web,
several backlog epics (push, offline, moderation, shop) are unstarted, and a cluster of
production-hardening items (logout revocation, rate limiting, deploy config) are absent.

### Current Completion
- **Against the agreed MVP scope** (epics 01–04, 07 + 05/06/08/09 core): **~85%**
- **Against the full 10-epic backlog vision** (incl. push, offline, moderation, shop, release): **~55%**
- **Completed (core done, minor gaps):** Foundation (01), Runs (04), Territory (07), Rewards (09), Shared library
- **In progress (working but incomplete):** Auth (02), GPS/Maps (03), Social (05), Challenges (06), Clubs (08), Mobile, QA/Release (10)
- **Not started:** Push notifications, Offline maps, Background tracking, Club invites/events/moderation, Coin shop, Analytics/crash reporting, Production deployment

---

## Module Status

| Module | Status | Progress | Notes (evidence) |
|--------|--------|----------|------|
| 01 Foundation | 🟢 Good shape | 80% | Workspaces, PostGIS compose, zod env (`config.ts`), pino logger, error middleware (`middleware.ts:44`), crash handlers (`index.ts:7`), CI. Missing: app Dockerfile/deploy, wired request logging. |
| 02 Auth | 🟡 In progress | 70% | register/login/refresh-rotation/me (`routes/auth.ts`), profile PATCH (`routes/users.ts:23`). Missing: **logout revocation**, **role enforcement** (`role` column unused), rate limiting, settings. |
| 03 GPS/Maps | 🟡 In progress | 55% | Web `watchPosition`+simulator (`recorder.ts`,`simulator.ts`), mobile GPS, MapLibre/OSM overlay (`useTerritoryOverlay.ts`). Missing: background tracking, offline maps, geofence, saved routes. |
| 04 Runs | 🟢 Good shape | 80% | CRUD + validation + PBs + GPX export (`services/runs.ts`, `routes/runs.ts:53`), history + 7-day chart. Missing: GPX **import**, filter/search UI. |
| 05 Social | 🟡 In progress | 65% | friends/requests/feed (`services/social.ts`), web-only. Missing: sharing, privacy settings; no mobile parity. |
| 06 Challenges | 🟡 In progress | 50% | join/progress/complete/rewards (`gamification.ts:116`). Missing: **scheduler** (seeded once, then expire), reminders; `:id/leaderboard` **built but never called**. |
| 07 Territory | 🟢 Good shape | 70% | Capture engine (new/steal/retain, transactional, history) + bbox GeoJSON + leaderboard (`services/territory.ts`). Missing: conflict/decay rules, admin tools, territory-history view. |
| 08 Clubs | 🟡 In progress | 55% | create/join/leave (ownership transfer + cascade delete)/chat/rankings (`services/clubs.ts`). Missing: invites, events, moderation, scheduled battles. |
| 09 Rewards | 🟢 Good shape | 75% | 12 achievements, streaks, XP/level curve, coin **accrual** (`economy.ts`, `gamification.ts`). Missing: coin **spending/shop** — dead-end currency. |
| 10 QA/Release | 🟡 In progress | 40% | 55 tests (shared+API), lint, typecheck, CI w/ PostGIS. Missing: **web/mobile tests (zero)**, security review, perf/a11y automation, analytics, crash reporting, store release. |
| Mobile app | 🟡 In progress | 30% | login + map + record + submit + styled report only (`apps/mobile/App.tsx`). No history/social/clubs/challenges/profile/leaderboard/achievements/GPX/simulator. |

---

## Completed Features
- **Auth**: registration, login, JWT access(15m)+refresh(30d) with rotation, bcrypt(10), `GET /auth/me` (`services/auth.ts`).
- **Run pipeline**: zod-validated submission, anti-cheat max-speed check (`runs.ts:29`), haversine distance, PB detection, one DB transaction (`runs.ts:59`).
- **Territory capture**: slippy-tile grid (zoom 18), DDA path traversal (`grid.ts:cellsOnPath`), new/steal/retain classification, transactional upsert + `cell_captures` history, viewport GeoJSON, turf leaderboard.
- **Gamification**: XP/coins/level curve, UTC daily streak, declarative 12-achievement evaluator (11 in `ACHIEVEMENT_RULES` + `level_5` inline at `gamification.ts:152`), challenge progress on run save.
- **Social**: user search, bidirectional friend requests, friends list with stats, activity feed (self + friends).
- **Clubs**: create/browse(ranked)/join/leave, member-only polling chat, ownership succession + empty-club deletion.
- **Web app**: 8 screens, TanStack Query state, transparent token-refresh interceptor (`client.ts:67`), MapLibre map, PWA (SW activated, manifest + real icons).
- **Shared library**: grid + economy math, 21 unit tests, reused by API and clients.

---

## Partially Implemented Features
- **Profile editing** — `PATCH /users/me` works (`routes/users.ts:23`) but **no client calls it**; the web `patch()` helper (`client.ts:99`) is **entirely unused**. Users cannot change name/color in the UI.
- **Roles/authorization** — `users.role` exists (`schema.ts:21`) but **no `requireRole`/admin middleware** and no route checks it. RBAC is schema-only.
- **Challenges lifecycle** — inserted only by `seed.ts:36` for the current week. **No scheduler**, so after the seeded week `GET /challenges` returns `[]` (filter at `routes/gamification.ts:57`).
- **Challenge leaderboard** — `GET /challenges/:id/leaderboard` implemented (`gamification.ts:102`) but **no frontend calls it**.
- **Mobile parity** — only auth/territory/runs endpoints are called (`App.tsx:192,277,336`); ~70% of features are web-only.

---

## Missing Features (not started)
- **Push notifications** (06) — no `expo-notifications`/FCM/APNs.
- **Background GPS tracking** (03) — mobile is foreground-only.
- **Offline maps** (03), **geofence** (03), **saved/reusable routes** (03).
- **GPX import** (04) — only export exists.
- **Club invites, events, moderation** (08); **scheduled head-to-head battles**.
- **Social sharing & privacy settings** (05).
- **Coin shop / spending** (09) — coins accrue with no sink.
- **Analytics, crash reporting, app-store release** (10).
- **Production deployment** — no API `Dockerfile`/`.dockerignore`/deploy config (only `docker-compose.yml` for the DB).

---

## Bugs & Risks
1. **Pause doesn't stop the clock** *(functional bug)*. Paused fixes are dropped (`recorder.ts:58`) but elapsed = `last.t − first.t` (`recorder.ts:67`), and the server computes duration the same way (`runs.ts:25`). Pausing still counts paused wall-clock toward duration and pace.
2. **Backdated runs corrupt streaks** *(edge-case bug)*. Streak uses `run.startedAt`'s date and overwrites `lastRunDate` unconditionally (`gamification.ts:54,176`). Out-of-order submissions can move the streak backward.
3. **No server-side logout** *(security)*. No `/auth/logout` route; web logout only clears localStorage (`AuthContext.logout`). Refresh token stays valid 30 days.
4. **Tokens in localStorage** *(security)*. `rt_access`/`rt_refresh` (`client.ts:5`) are XSS-exfiltratable; with #3, a leaked refresh token is long-lived.
5. **No rate limiting or security headers** *(security)*. `app.ts` uses only `cors` — login is brute-forceable and responses lack helmet headers.
6. **Refresh tokens never pruned** — deleted only on rotation (`auth.ts:99`); expired rows accumulate unbounded.
7. **Incomplete bbox validation** — `territoryInBBox` checks north/west but not south/east (`territory.ts:101`). Masked by the route zod schema today, unsafe if called directly.

---

## Technical Debt
- **PostGIS entirely unused** — zero `geometry` columns or `ST_` calls; `runs` stores only `rawPoints jsonb` (`schema.ts:62`), territory uses integer tile coords. Plain `postgres:16` would suffice.
- **`pino-http` installed but never wired** (`app.ts` has no request logging) — unused dependency.
- **Mobile outside CI and workspaces** — root `workspaces` = `packages/*, apps/api, apps/web`; eslint ignores `apps/mobile/**`. Mobile gets **no lint/typecheck/test/bundle in CI**.
- **Zero web/mobile tests** — `apps/web` has no `test` script; all 55 tests are API + shared.
- **Demo accounts with known password** (`demo/rival` / `demo1234`, `seed.ts:64`) — must be gated out of production.
- **All time logic is UTC-only** (streaks, weekly challenges, week boundaries) — documented, but a correctness limit for non-UTC users.

---

## Code Quality Issues (baseline quality is high)
- **O(n²) distance recompute**: `onPoint` recomputes `pathDistanceM` over the whole array each fix (`recorder.ts:66`) — should accumulate the last segment.
- **Cartesian over-fetch**: `captureCells` filters `inArray(x, xs) AND inArray(y, ys)` (`territory.ts:48`), reading off-path cells. Harmless (ignored) but wasteful.
- **`detectPersonalBests` loads all prior runs per submission** (`runs.ts:106`) — bounded but O(n) per run.
- **Dead API surface**: `patch()` helper, `useAuth().setUser`, `GET /clubs/:id` for non-members, and the challenge-leaderboard endpoint are unreferenced by any caller.

---

## Recommended Refactoring
1. Extract the duplicated week helper (defined 3×: `territory.ts:165`, `clubs.ts:16`, `seed.ts:21`) into `packages/shared`.
2. Make time moving-aware: track paused offset in the recorder; store `movingTimeS` separate from elapsed.
3. Swap `postgis/postgis` → `postgres:16` (or actually use PostGIS), and remove/wire `pino-http`.
4. Incrementalize `recorder` distance and `detectPersonalBests` (running max on `user_stats`).
5. Remove dead surface (`patch`, `setUser` on context type) or ship the profile-edit UI that justifies them.

---

## Next Development Roadmap (Prioritized)
1. **Production-hardening (security-blocking):** `/auth/logout` with revocation, `helmet`, `express-rate-limit` on auth; expired-token cleanup. *(Risks #3–6)*
2. **Fix pause/streak correctness bugs** *(Risks #1–2)* — cheap, user-visible.
3. **Challenge lifecycle** — scheduled or lazy-on-read weekly challenge generation.
4. **Mobile feature parity** — port history/profile/leaderboard/social/challenges to Expo (API already supports all of it; client work only).
5. **Test coverage for web/mobile** — component/integration tests; bring mobile into CI.
6. **Deployment** — API `Dockerfile` + `.dockerignore` + deploy target; production seed without demo accounts.
7. **Breadth features** — coin shop, club invites/moderation, then push + background tracking (need a custom dev-client build, not Expo Go).

---

## Suggested Milestones
- **M1 — Production-ready core (1–2 wks):** Roadmap 1–3. The existing web app becomes safe and correct to deploy.
- **M2 — One product, two clients (2–3 wks):** Roadmap 4–5. Mobile reaches parity; CI covers all three surfaces.
- **M3 — Shipped (1 wk):** Roadmap 6. Deployed backend + installable PWA + Expo build on a device.
- **M4 — Depth & retention (ongoing):** Roadmap 7. Coin economy, richer clubs, notifications.

---

**Bottom line:** the foundation and core loop are solid and clean enough to build on directly —
there is no throwaway code here. The work ahead is finishing breadth (mobile parity, deferred
epics) and closing a short, well-defined list of production-hardening gaps, in that priority order.
