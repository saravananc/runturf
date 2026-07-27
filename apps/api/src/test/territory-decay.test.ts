import { TERRITORY_DECAY_DAYS } from '@runturf/shared';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { decayTerritory } from '../services/territory.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);
const DAY = 86_400_000;

// Fresh remote ocean so cells never collide with other suites' data.
const baseLat = -60 - Math.random() * 5;
const baseLng = -160 - Math.random() * 10;

// Each user runs its own east–west lane (distinct latitude) so cells don't overlap.
function lane(offsetNorthM: number, meters = 500) {
  const start = Date.now() - 3_600_000;
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

async function makeUser(name: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `tdk_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const cellCount = async (id: string) =>
  (await pool.query('SELECT count(*)::int AS n FROM territory_cells WHERE owner_id=$1', [id]))
    .rows[0].n as number;
const ageCells = (id: string, daysAgo: number) =>
  pool.query('UPDATE territory_cells SET captured_at=$1 WHERE owner_id=$2', [
    new Date(Date.now() - daysAgo * DAY),
    id,
  ]);

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tdk\\_${tag}%`]);
  await pool.end();
});

describe('territory decay', () => {
  it('removes cells older than the cutoff and keeps fresh ones', async () => {
    const u = await makeUser('expire');
    expect((await request(app).post('/runs').set(auth(u.token)).send(lane(0))).status).toBe(201);
    expect(await cellCount(u.id)).toBeGreaterThan(0);

    // Just inside the window: survives.
    await ageCells(u.id, TERRITORY_DECAY_DAYS - 1);
    expect(await decayTerritory()).toBe(0);
    const fresh = await cellCount(u.id);
    expect(fresh).toBeGreaterThan(0);

    // Past the window: swept back to neutral.
    await ageCells(u.id, TERRITORY_DECAY_DAYS + 1);
    expect(await decayTerritory()).toBe(fresh);
    expect(await cellCount(u.id)).toBe(0);
  });

  it('reclaims decayed turf as new, not stolen', async () => {
    const a = await makeUser('owner');
    const b = await makeUser('taker');
    expect((await request(app).post('/runs').set(auth(a.token)).send(lane(300))).status).toBe(201);
    const owned = await cellCount(a.id);
    expect(owned).toBeGreaterThan(0);

    await ageCells(a.id, TERRITORY_DECAY_DAYS + 2); // A lets the turf lapse

    // B runs the same lane. Run-submit decays first, so the lapsed cells are
    // neutral — B captures them as NEW, and nothing is recorded as stolen.
    const rep = await request(app).post('/runs').set(auth(b.token)).send(lane(300));
    expect(rep.status).toBe(201);
    expect(rep.body.run.cellsStolen).toBe(0);
    expect(rep.body.run.cellsCaptured).toBe(owned);
    expect(await cellCount(a.id)).toBe(0);
    expect(await cellCount(b.id)).toBe(owned);
  });

  it('reports freshness in the GeoJSON that drops with age', async () => {
    const u = await makeUser('fresh');
    expect((await request(app).post('/runs').set(auth(u.token)).send(lane(1200))).status).toBe(201);

    // Wide bbox over all lanes; filter to this user's cells.
    const q = `west=${baseLng - 0.001}&south=${baseLat - 0.001}&east=${baseLng + 0.02}&north=${baseLat + 0.03}`;
    const mine = (fc: { features: { properties: { ownerId: string; freshness: number } }[] }) =>
      fc.features.filter((f) => f.properties.ownerId === u.id);

    const first = await request(app).get(`/territory?${q}`).set(auth(u.token));
    expect(first.status).toBe(200);
    const freshCells = mine(first.body);
    expect(freshCells.length).toBeGreaterThan(0);
    expect(freshCells.every((f) => f.properties.freshness > 0.98)).toBe(true);

    // Halfway to the cutoff → freshness near 0.5.
    await ageCells(u.id, TERRITORY_DECAY_DAYS / 2);
    const later = mine((await request(app).get(`/territory?${q}`).set(auth(u.token))).body);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((f) => f.properties.freshness > 0.4 && f.properties.freshness < 0.6)).toBe(
      true,
    );
  });

  it('refreshes freshness on revisit, so active turf survives a sweep', async () => {
    const revisit = await makeUser('revisit');
    const idle = await makeUser('idle');
    expect((await request(app).post('/runs').set(auth(revisit.token)).send(lane(600))).status).toBe(
      201,
    );
    expect((await request(app).post('/runs').set(auth(idle.token)).send(lane(900))).status).toBe(
      201,
    );
    const revisitOwned = await cellCount(revisit.id);

    // Both users' turf is nearly stale.
    await ageCells(revisit.id, TERRITORY_DECAY_DAYS - 1);
    await ageCells(idle.id, TERRITORY_DECAY_DAYS - 1);

    // Only `revisit` runs the lane again — a retain that refreshes capturedAt.
    const again = await request(app).post('/runs').set(auth(revisit.token)).send(lane(600));
    expect(again.status).toBe(201);

    // A sweep with a 1-day cutoff would delete the stale cells; the refreshed
    // ones (captured just now) survive, the idle ones do not.
    await decayTerritory(undefined, new Date(Date.now() - DAY));
    expect(await cellCount(revisit.id)).toBe(revisitOwned);
    expect(await cellCount(idle.id)).toBe(0);
  });
});
