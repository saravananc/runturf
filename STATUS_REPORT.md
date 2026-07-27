# RunTurf — Backlog vs. Implementation Status Report

> Comparison of planned scope (`backlog/*.xlsx`) against delivered work
> (`PROJECT_ASSESSMENT.md`). Feature-level analysis; see method notes below.

## Method & caveats (from the two sources only)

- **Backlog** = 10 epic files + master (405 tasks, 81 features, 972 SP). All rows
  are marked `Todo`; task names are placeholders, so scope is read from
  **Feature** names, counts, priority (162 High / 243 Medium), and story points.
- **Implementation truth** = `PROJECT_ASSESSMENT.md`. Its header (through commit
  `4c1be1d`) states the prioritized roadmap is complete; its **body module
  percentages are stale** (written at `32ae0bf`, before coin shop, club
  invites/moderation, GPX import, mobile parity, web/mobile tests, deployment,
  and Detox landed). Where the two disagree, the header/roadmap table is newer.
- Completion is **feature-weighted** (done = 1, partial = 0.5, pending = 0).
- **Deviation:** the backlog names **Mapbox**; the assessment shows it built on
  **MapLibre/OSM** — functionally equivalent, different technology than planned.

---

## 1. Completed Features

Features the assessment confirms as fully implemented (commit noted where given).

| Epic | Completed features |
|---|---|
| **01 Foundation** | Architecture, Project Setup, Config (zod env), Env, Logging (pino + `pino-http` wired `5687af1`), CI/CD, Docker (API Dockerfile + compose `0979d83`), Monitoring (Sentry crash reporting + first-party analytics `3e3854f`) |
| **02 Auth** | Register, Login, JWT (access 15 m + refresh 30 d rotation **+ logout revocation** `35f726e`), Profile (PATCH + edit UI `5687af1`) |
| **03 GPS/Maps** | GPS (watchPosition + mobile), Map rendering (MapLibre/OSM), Permissions, Foreground Tracking |
| **04 Runs** | Run CRUD, PB detection, History (+7-day chart), Export (GPX), **Import (GPX `121f903`)**, Stats |
| **05 Social** | Friends, Requests, Feed, Search, Leaderboard, Profiles |
| **06 Challenges** | Challenges (join/progress/complete), Rewards, **Scheduler (weekly lifecycle `600dbd3`)** |
| **07 Territory** | Capture engine, Grid (slippy-tile z18), Ownership (new/steal/retain), History (`cell_captures`), Rendering (viewport GeoJSON), Scoring (turf leaderboard), Conflict (decay — turf fades if not revisited `9d81fc6`) |
| **08 Clubs** | Clubs (create/join/leave), Chat, Members (ownership succession), Rankings, **Invites + Moderation (`1d59aab`)**, Battles (scheduled head-to-head turf wars) |
| **09 Rewards** | Achievements (12), Levels, Streaks (+ freeze), XP, **Coins (accrual + shop spending `298e886`)** |
| **10 QA/Release** | Testing (236 tests: shared + API + web + mobile + Detox), Automation (CI + `mobile-e2e`), Docs (deploy README), Analytics (first-party events `3e3854f`) |

**~57 of 81 features fully done.**

---

## 2. Pending Work (not started)

| Epic | Pending features | Priority signal |
|---|---|---|
| **03 GPS/Maps** | Background tracking, Battery optimization, Geofence, Offline maps, Routes (saved/reusable) | High-weight epic (20 High tasks) |
| **04 Runs** | Filters, Search (history filter/search UI) | Medium |
| **05 Social** | Privacy (settings), Sharing (social share) | Medium |
| **06 Challenges** | Events, Notifications, Push, Reminders | Mixed; needs custom dev-client |
| **07 Territory** | Rules (caps/limits), Admin tools | Medium |
| **08 Clubs** | Events (club-wide events beyond battles) | Medium |
| **10 QA/Release** | Performance, Accessibility, Store (app-store release) | 20 High tasks concentrated here |
| **02 Auth** | Settings (dedicated user/privacy settings) | Medium |

**~20 features unstarted**, concentrated in **03 (GPS depth), 06 (push/events), 10 (release breadth)**.

---

## 3. Partially Completed Items

| Epic · Feature | Done | Missing |
|---|---|---|
| 10 · Crash reporting | Sentry on API + web, env-gated (`3e3854f`) | Mobile native `@sentry/react-native` (needs prebuild + Detox re-verify) |
| 02 · Roles | Club-level roles enforced (`requireOwner`) | Global `users.role` (site-admin) still unenforced |
| 03 · Location Sync | Batch point submission on run save | Live/background sync |
| 07 · Sync | Viewport GeoJSON fetch/render | Full territory sync semantics |
| 07 · History | Backend capture history stored | Territory-history **view** (UI) |
| 09 · Badges | Achievements serve as badges | No distinct badge system named |
| 10 · Security | helmet, rate limiting, logout revocation, token cleanup | Formal security review; tokens still in `localStorage` (mitigated, not eliminated) |
| 10 · Release | Docker/deploy done | App-store release not started |
| Detox (10 · Testing) | Core flows green on Android emulator | Synthetic GPS traces, native document-picker UI, iOS (needs macOS runner) |

---

## 4. Missing from Backlog

**Implemented but not represented as backlog features:**

- **Mobile client as a whole** — no dedicated Mobile epic exists; mobile work
  spans epics, so the ~9-screen Expo app has no backlog home.
- **PWA / service worker** (installable web app) — not a named feature.
- **Run simulator** (dev/testing tool) and the **transparent token-refresh
  interceptor** — not itemized.

**Backlog features with no implementation yet:** all Pending items in §2
(Background, Battery, Geofence, Offline, Routes, Filters, Search, Privacy,
Sharing, Events, Notifications, Push, Reminders, Conflict, Rules, Admin, Battles,
Performance, Accessibility, Store, Settings).

**Deviation:** backlog specifies **Mapbox** (03); implementation uses
**MapLibre/OSM** — functionally equivalent, different technology than planned.

**Process note:** the backlog's Status column is 100% `Todo` and out of sync with
reality — it should be updated to reflect the ~54 completed features so it stays
a usable planning artifact.

---

## 5. Priority Recommendations (recommended order)

1. **Verify `mobile-e2e` CI on GitHub** — the job is wired but has never run on a
   hosted runner (assessment flags the first run may need an emulator-timing
   tweak). Closes verification debt on work already done. *(No dependencies.)*
2. **Crash reporting + Analytics (10)** — small, unblocks safe rollout; nothing
   currently reports a production crash. *(No dependencies; do before release.)*
3. **App-store Release + Store (10)** — real signing keystore (release currently
   signed with the debug key), store listing, EAS Build. **This is the gate**
   that also unblocks push, background GPS, and iOS Detox (all need a custom
   dev-client). *(Blocks #4, #5.)*
4. **Push / Notifications / Reminders (06)** and **Background + Battery tracking
   (03)** — highest-value retention features; depend on #3's dev-client.
   *(Depends on #3.)*
5. **Offline maps, Geofence, Saved Routes (03)** — core GPS depth for a running
   app used mid-run without connectivity. *(Partially depends on #3.)*
6. **Territory Conflict/Decay Rules + Admin (07)**, **Club Events/Battles (08)**,
   **Social Privacy/Sharing (05)** — game-loop and social depth. *(Independent.)*
7. **Runs Filters/Search (04)**, **Auth Settings (02)**, **Performance +
   Accessibility (10)** — polish. *(Independent, low risk.)*

---

## 6. Summary — Completion by Module

| Epic | Features done / total | SP | Est. completion |
|---|---|---|---|
| 01 Foundation | 8 / 8 | 96 | **~100%** 🟢 |
| 02 Auth | 4 + ½ (Roles) / 6 | 72 | **~75%** 🟡 |
| 03 GPS/Maps | 4 + ½ (Sync) / 10 | 120 | **~45%** 🔴 |
| 04 Runs | 6 / 8 | 96 | **~75%** 🟡 |
| 05 Social | 6 / 8 | 96 | **~75%** 🟡 |
| 06 Challenges | 3 / 7 | 84 | **~43%** 🔴 |
| 07 Territory | 7 + ½ (Sync) / 10 | 120 | **~75%** 🟡 |
| 08 Clubs | 7 / 8 | 96 | **~88%** 🟢 |
| 09 Rewards | 5 + ½ (Badges) / 6 | 72 | **~92%** 🟢 |
| 10 QA/Release | 4 + 1½ (½ Security, ½ Release, ½ Crash) / 10 | 120 | **~55%** 🟡 |

**Overall (full 10-epic vision): ~71% complete** — feature-weighted. Recent work:
crash-reporting + analytics (`3e3854f`) took Foundation to complete and QA/Release
to ~55%; territory decay (`9d81fc6`) took Territory to ~75%; club battles took
Clubs to ~88%.

**Overall (MVP / prioritized roadmap): ~95%+ complete** — the assessment's header
confirms the entire prioritized roadmap (auth → GPS run → territory capture →
rewards → social → clubs → shop → deployment → tests → device E2E) is done. The
core game loop works end-to-end on web and is verified on-device.

**Where the remaining ~34% lives:** almost entirely in **deferred breadth** —
mobile-platform features needing a custom dev-client (push, background GPS: epics
03/06), GPS depth (offline, geofence, routes), and release-readiness (analytics,
crash reporting, store, a11y, perf: epic 10). None block the current product; all
are net-new.
