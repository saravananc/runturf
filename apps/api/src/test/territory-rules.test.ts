import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 6);

const baseLat = -35 - Math.random() * 5;
const baseLng = 20 + Math.random() * 10;

function lane(offsetNorthM = 0, meters = 400) {
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
    .send({ username: `trl_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const submitRun = (u: { token: string }, body: ReturnType<typeof lane>) =>
  request(app).post('/runs').set(auth(u.token)).send(body);
const cellCount = async (id: string) =>
  (await pool.query('SELECT count(*)::int AS n FROM territory_cells WHERE owner_id=$1', [id]))
    .rows[0].n as number;
const makeAdmin = (id: string) => pool.query("UPDATE users SET role='admin' WHERE id=$1", [id]);

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`trl\\_${tag}%`]);
  await pool.end();
});

describe('steal protection', () => {
  it('shields freshly captured turf from being stolen', async () => {
    const owner = await makeUser('owner');
    const raider = await makeUser('raider');
    expect((await submitRun(owner, lane(0))).status).toBe(201);
    const owned = await cellCount(owner.id);
    expect(owned).toBeGreaterThan(0);

    // Raider runs the same lane immediately — every cell is still protected.
    const rep = await submitRun(raider, lane(0));
    expect(rep.status).toBe(201);
    expect(rep.body.run.cellsStolen).toBe(0);
    expect(rep.body.run.cellsCaptured).toBe(0);
    expect(await cellCount(owner.id)).toBe(owned); // owner keeps it all
    expect(await cellCount(raider.id)).toBe(0);
  });

  it('allows stealing once the protection window has passed', async () => {
    const owner = await makeUser('owner2');
    const raider = await makeUser('raider2');
    expect((await submitRun(owner, lane(300))).status).toBe(201);
    const owned = await cellCount(owner.id);

    // Age the owner's turf past the protection window (but not the decay window).
    await pool.query(
      "UPDATE territory_cells SET captured_at = now() - interval '2 hours' WHERE owner_id=$1",
      [owner.id],
    );

    const rep = await submitRun(raider, lane(300));
    expect(rep.body.run.cellsStolen).toBe(owned);
    expect(await cellCount(owner.id)).toBe(0);
    expect(await cellCount(raider.id)).toBe(owned);
  });
});

describe('admin', () => {
  it('rejects non-admins and serves the overview to admins', async () => {
    const plain = await makeUser('plain');
    expect((await request(app).get('/admin/overview').set(auth(plain.token))).status).toBe(403);

    const boss = await makeUser('boss');
    await makeAdmin(boss.id); // role is read from the DB per request — no re-login needed
    const ov = await request(app).get('/admin/overview').set(auth(boss.token));
    expect(ov.status).toBe(200);
    expect(ov.body.users).toBeGreaterThan(0);
    expect(typeof ov.body.cells).toBe('number');
    expect(typeof ov.body.activeBattles).toBe('number');
  });

  it('lets an admin force decay and wipe a user’s territory', async () => {
    const boss = await makeUser('boss2');
    await makeAdmin(boss.id);
    const victim = await makeUser('victim');
    expect((await submitRun(victim, lane(600))).status).toBe(201);
    expect(await cellCount(victim.id)).toBeGreaterThan(0);

    const decay = await request(app).post('/admin/territory/decay').set(auth(boss.token));
    expect(decay.status).toBe(200);
    expect(typeof decay.body.removed).toBe('number');

    const wipe = await request(app)
      .delete(`/admin/users/${victim.id}/territory`)
      .set(auth(boss.token));
    expect(wipe.status).toBe(200);
    expect(wipe.body.removed).toBeGreaterThan(0);
    expect(await cellCount(victim.id)).toBe(0);
  });
});
