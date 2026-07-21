import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { RunReport } from '@runturf/shared';
import { createApp } from '../app.js';
import { db, pool } from '../db/client.js';
import { challenges } from '../db/schema.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);

// Fresh patch of ocean so territory is unowned on every test execution.
const baseLat = -35 - Math.random() * 5;
const baseLng = -140 - Math.random() * 10;

/** Straight-line run: `meters` long, heading east, at ~3 m/s. */
function syntheticRun(offsetNorthM = 0, meters = 600) {
  const start = Date.now() - 3_600_000;
  const lat = baseLat + offsetNorthM / 111_320;
  const points = [];
  const step = 10; // meters between fixes
  for (let d = 0; d <= meters; d += step) {
    points.push({
      lat,
      lng: baseLng + d / (111_320 * Math.cos((lat * Math.PI) / 180)),
      t: start + (d / 3) * 1000,
      acc: 5,
    });
  }
  return { startedAt: new Date(start).toISOString(), points };
}

async function makeUser(name: string): Promise<string> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `t_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

let alice = '';
let bob = '';
let challengeId = '';

beforeAll(async () => {
  alice = await makeUser('alice');
  bob = await makeUser('bob');
  const [ch] = await db
    .insert(challenges)
    .values({
      code: `t_${tag}_dist`,
      title: 'Test distance challenge',
      description: 'test',
      metric: 'distance_m',
      target: 500,
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000),
      coinReward: 11,
      xpReward: 33,
    })
    .returning();
  challengeId = ch.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM challenges WHERE code LIKE $1', [`t\\_${tag}%`]);
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`t\\_${tag}%`]);
  await pool.end();
});

describe('run submission pipeline', () => {
  let aliceReport: RunReport;

  it('rejects implausible and malformed runs', async () => {
    const tooFast = {
      startedAt: new Date().toISOString(),
      points: [
        { lat: baseLat, lng: baseLng, t: 1_700_000_000_000 },
        { lat: baseLat + 0.1, lng: baseLng, t: 1_700_000_060_000 }, // ~11km in 1 min
      ],
    };
    const res = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send(tooFast);
    expect(res.status).toBe(400);

    const onePoint = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send({ startedAt: new Date().toISOString(), points: [{ lat: 0, lng: 0, t: 1 }] });
    expect(onePoint.status).toBe(400);
  });

  it('joins a challenge before running', async () => {
    const res = await request(app)
      .post(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${alice}`);
    expect(res.status).toBe(201);
  });

  it('accepts a valid run: distance, captures, XP, achievements', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send(syntheticRun());
    expect(res.status).toBe(201);
    aliceReport = res.body as RunReport;

    expect(aliceReport.run.distanceM).toBeGreaterThan(550);
    expect(aliceReport.run.distanceM).toBeLessThan(650);
    // 600 m at ~120 m/cell ≥ 4 cells, all previously unowned
    expect(aliceReport.run.cellsCaptured).toBeGreaterThanOrEqual(4);
    expect(aliceReport.run.cellsStolen).toBe(0);
    expect(aliceReport.xpGained).toBeGreaterThan(0);

    const codes = aliceReport.newAchievements.map((a) => a.code);
    expect(codes).toContain('first_run');
    expect(codes).toContain('first_capture');
    expect(aliceReport.stats.totalRuns).toBe(1);
    expect(aliceReport.stats.streakDays).toBe(1);
    expect(aliceReport.stats.cellsOwned).toBe(aliceReport.run.cellsCaptured);
  });

  it('tracks challenge progress and completion rewards', async () => {
    const res = await request(app)
      .get('/challenges')
      .set('Authorization', `Bearer ${alice}`);
    expect(res.status).toBe(200);
    const mine = res.body.find((c: { id: string }) => c.id === challengeId);
    expect(mine.joined).toBe(true);
    expect(mine.progress).toBeCloseTo(aliceReport.run.distanceM, 1);
    expect(mine.completed).toBe(true); // 600 m > 500 m target
  });

  it('lets a rival steal overlapping cells', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${bob}`)
      .send(syntheticRun(0)); // same line as alice
    expect(res.status).toBe(201);
    const report = res.body as RunReport;
    expect(report.run.cellsStolen).toBeGreaterThanOrEqual(4);
    expect(report.newAchievements.map((a) => a.code)).toContain('first_steal');
  });

  it('reflects ownership on the territory endpoint', async () => {
    const d = 0.01;
    const res = await request(app)
      .get(
        `/territory?west=${baseLng - d}&south=${baseLat - d}&east=${baseLng + 0.02}&north=${baseLat + d}`,
      )
      .set('Authorization', `Bearer ${alice}`);
    expect(res.status).toBe(200);
    expect(res.body.features.length).toBeGreaterThanOrEqual(4);
    // bob owns the contested line now
    const owners = new Set(res.body.features.map((f: { properties: { ownerName: string } }) => f.properties.ownerName));
    expect(owners.has(`t_${tag}_bob`)).toBe(true);
  });

  it('ranks the leaderboard by cells owned', async () => {
    const res = await request(app)
      .get('/territory/leaderboard')
      .set('Authorization', `Bearer ${alice}`);
    expect(res.status).toBe(200);
    const names = res.body.map((e: { user: { username: string } }) => e.user.username);
    const bobIdx = names.indexOf(`t_${tag}_bob`);
    const aliceIdx = names.indexOf(`t_${tag}_alice`);
    expect(bobIdx).toBeGreaterThanOrEqual(0);
    expect(aliceIdx).toBeGreaterThanOrEqual(0);
    expect(bobIdx).toBeLessThan(aliceIdx); // bob stole everything alice had
  });

  it('run history and detail round-trip', async () => {
    const list = await request(app).get('/runs').set('Authorization', `Bearer ${alice}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    const detail = await request(app)
      .get(`/runs/${list.body[0].id}`)
      .set('Authorization', `Bearer ${alice}`);
    expect(detail.status).toBe(200);
    expect(detail.body.points.length).toBeGreaterThan(50);

    // other users cannot read someone else's run
    const forbidden = await request(app)
      .get(`/runs/${list.body[0].id}`)
      .set('Authorization', `Bearer ${bob}`);
    expect(forbidden.status).toBe(404);
  });

  it('same-day second run keeps streak at 1 and stacks stats', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send(syntheticRun(500)); // parallel line 500 m north — fresh cells
    expect(res.status).toBe(201);
    const rep = res.body as RunReport;
    expect(rep.stats.totalRuns).toBe(2);
    expect(rep.stats.streakDays).toBe(1);
    expect(rep.run.cellsCaptured).toBeGreaterThanOrEqual(4);
  });
  it('excludes paused time from duration and pace', async () => {
    const run = syntheticRun(1000, 600); // 600 m over 200 s of GPS timestamps
    const noPause = await request(app).post('/runs').set('Authorization', `Bearer ${alice}`).send(run);
    expect(noPause.status).toBe(201);

    const withPause = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send({ ...syntheticRun(1500, 600), pausedMs: 60_000 }); // 60 s paused
    expect(withPause.status).toBe(201);

    // Same distance + same timestamp span, but a minute of it was paused.
    expect(withPause.body.run.durationS).toBe(noPause.body.run.durationS - 60);
    // Shorter moving time => faster pace (lower s/km).
    expect(withPause.body.run.avgPaceSPerKm).toBeLessThan(noPause.body.run.avgPaceSPerKm);
  });

  it('rejects a paused duration longer than the run itself', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send({ ...syntheticRun(2000, 400), pausedMs: 999_999_999 });
    expect(res.status).toBe(400);
  });

  it('a backdated run never rewinds the streak or lastRunDate', async () => {
    const before = await request(app).get('/users/me/stats').set('Authorization', `Bearer ${alice}`);
    const streakBefore = before.body.streakDays;
    const lastRunBefore = before.body.lastRunDate;
    expect(lastRunBefore).toBeTruthy();

    // Submit a run dated a week in the past.
    const old = syntheticRun(2500, 400);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const res = await request(app)
      .post('/runs')
      .set('Authorization', `Bearer ${alice}`)
      .send({ ...old, startedAt: weekAgo.toISOString() });
    expect(res.status).toBe(201);

    // Streak must not reset to 1, and lastRunDate must not move backwards.
    expect(res.body.stats.streakDays).toBe(streakBefore);
    expect(res.body.stats.lastRunDate).toBe(lastRunBefore);
  });
});
