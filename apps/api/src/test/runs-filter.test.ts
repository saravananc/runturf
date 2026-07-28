import type { RunSummary } from '@runturf/shared';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 6);

const baseLat = 12 + Math.random() * 5;
const baseLng = 95 + Math.random() * 10;

/** A run of `meters`, started `daysAgo`, on its own lane so captures don't clash. */
function run(daysAgo: number, meters: number, offsetNorthM: number) {
  const start = Date.now() - daysAgo * 86_400_000;
  const lat = baseLat + offsetNorthM / 111_320;
  const points = [];
  for (let d = 0; d <= meters; d += 10) {
    points.push({
      lat,
      lng: baseLng + d / (111_320 * Math.cos((lat * Math.PI) / 180)),
      t: start + (d / 3) * 1000,
      acc: 5,
    });
  }
  return { startedAt: new Date(start).toISOString(), points };
}

let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const list = async (qs = ''): Promise<RunSummary[]> => {
  const res = await request(app).get(`/runs${qs}`).set(auth());
  expect(res.status).toBe(200);
  return res.body;
};
const dayKey = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  const reg = await request(app)
    .post('/auth/register')
    .send({ username: `trf_${tag}`, password: 'password123' });
  expect(reg.status).toBe(201);
  token = reg.body.accessToken;

  // Three runs: 10 days ago / 400 m, 5 days ago / 1200 m, today / 800 m.
  for (const [daysAgo, meters, lane] of [
    [10, 400, 0],
    [5, 1200, 400],
    [0, 800, 800],
  ] as const) {
    const res = await request(app).post('/runs').set(auth()).send(run(daysAgo, meters, lane));
    expect(res.status).toBe(201);
  }
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`trf\\_${tag}%`]);
  await pool.end();
});

describe('GET /runs filtering and sorting', () => {
  it('returns every run newest-first by default (unchanged behaviour)', async () => {
    const runs = await list();
    expect(runs).toHaveLength(3);
    const dates = runs.map((r) => r.startedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('filters by date range', async () => {
    // Everything from 7 days ago onward excludes the 10-day-old run.
    const recent = await list(`?from=${dayKey(7)}`);
    expect(recent).toHaveLength(2);

    // A window that ends 7 days ago keeps only the oldest.
    const old = await list(`?to=${dayKey(7)}`);
    expect(old).toHaveLength(1);
    expect(Math.round(old[0].distanceM)).toBeGreaterThan(350);
    expect(Math.round(old[0].distanceM)).toBeLessThan(450);

    // `to` is inclusive of the whole day, so today's run is still matched.
    expect(await list(`?from=${dayKey(0)}&to=${dayKey(0)}`)).toHaveLength(1);
  });

  it('filters by distance', async () => {
    expect(await list('?minDistanceM=700')).toHaveLength(2);
    expect(await list('?maxDistanceM=700')).toHaveLength(1);
    expect(await list('?minDistanceM=700&maxDistanceM=1000')).toHaveLength(1);
  });

  it('sorts by distance and duration in both directions', async () => {
    const asc = (await list('?sort=distance&order=asc')).map((r) => Math.round(r.distanceM));
    expect(asc).toEqual([...asc].sort((a, b) => a - b));

    const desc = (await list('?sort=distance&order=desc')).map((r) => Math.round(r.distanceM));
    expect(desc).toEqual([...asc].reverse());

    const byTime = (await list('?sort=duration&order=asc')).map((r) => r.durationS);
    expect(byTime).toEqual([...byTime].sort((a, b) => a - b));
  });

  it('combines filters with sorting', async () => {
    const rows = await list(`?from=${dayKey(7)}&sort=distance&order=asc`);
    expect(rows).toHaveLength(2);
    expect(rows[0].distanceM).toBeLessThan(rows[1].distanceM);
  });

  it('rejects invalid queries', async () => {
    const bad = async (qs: string) => (await request(app).get(`/runs${qs}`).set(auth())).status;
    expect(await bad('?from=nonsense')).toBe(400);
    expect(await bad('?sort=magic')).toBe(400);
    expect(await bad(`?from=${dayKey(0)}&to=${dayKey(9)}`)).toBe(400); // from after to
    expect(await bad('?minDistanceM=900&maxDistanceM=100')).toBe(400);
  });
});
