import { runXp } from '@runturf/shared';
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);

// Fresh ocean per test file so captures never collide with other data.
const baseLat = -50 - Math.random() * 5;
const baseLng = -150 - Math.random() * 10;

function syntheticRun(offsetNorthM = 0, meters = 600, startedAt?: string) {
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
  return { startedAt: startedAt ?? new Date(start).toISOString(), points };
}

async function makeUser(name: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `tsh_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
const setCoins = (id: string, coins: number) =>
  pool.query('UPDATE user_stats SET coins=$1 WHERE user_id=$2', [coins, id]);

let buyer: { token: string; id: string };
let booster: { token: string; id: string };
let plain: { token: string; id: string };
let freezer: { token: string; id: string };

beforeAll(async () => {
  [buyer, booster, plain, freezer] = await Promise.all([
    makeUser('buyer'),
    makeUser('boost'),
    makeUser('plain'),
    makeUser('freeze'),
  ]);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tsh\\_${tag}%`]);
  await pool.end();
});

describe('coin shop', () => {
  it('lists items with the balance and zero owned', async () => {
    await setCoins(buyer.id, 100);
    const res = await request(app).get('/shop').set(auth(buyer));
    expect(res.status).toBe(200);
    expect(res.body.coins).toBe(100);
    const boost = res.body.items.find((i: { code: string }) => i.code === 'xp_boost');
    expect(boost).toMatchObject({ cost: 50, owned: 0 });
  });

  it('buys an item: deducts coins and grants it, atomically', async () => {
    const res = await request(app).post('/shop/xp_boost/buy').set(auth(buyer));
    expect(res.status).toBe(200);
    expect(res.body.coins).toBe(50);
    expect(res.body.item).toMatchObject({ code: 'xp_boost', owned: 1 });

    const shop = await request(app).get('/shop').set(auth(buyer));
    expect(shop.body.coins).toBe(50);
    expect(shop.body.items.find((i: { code: string }) => i.code === 'xp_boost').owned).toBe(1);
  });

  it('rejects a purchase when coins are short', async () => {
    await setCoins(buyer.id, 10);
    const res = await request(app).post('/shop/streak_freeze/buy').set(auth(buyer)); // costs 75
    expect(res.status).toBe(400);
  });

  it('404s on an unknown item', async () => {
    const res = await request(app).post('/shop/does_not_exist/buy').set(auth(buyer));
    expect(res.status).toBe(404);
  });

  it('XP Boost doubles a run’s base XP and is consumed', async () => {
    // Identical first runs on parallel lanes: same distance, same fresh cells,
    // same achievements — so the only XP difference is the boost.
    await setCoins(booster.id, 100);
    expect((await request(app).post('/shop/xp_boost/buy').set(auth(booster))).status).toBe(200);

    const plainRep = await request(app).post('/runs').set(auth(plain)).send(syntheticRun(0));
    const boostRep = await request(app).post('/runs').set(auth(booster)).send(syntheticRun(400));
    expect(plainRep.status).toBe(201);
    expect(boostRep.status).toBe(201);

    expect(boostRep.body.perksApplied).toContain('2× XP Boost');
    expect(plainRep.body.perksApplied).toEqual([]);

    // The boost doubles only the base run XP, so the gap equals that base.
    const base = runXp({
      distanceM: boostRep.body.run.distanceM,
      newCells: boostRep.body.run.cellsCaptured,
      stolenCells: 0,
      streakDays: 1,
    });
    expect(boostRep.body.xpGained - plainRep.body.xpGained).toBe(base);

    // Consumed: the boost is gone from inventory.
    const shop = await request(app).get('/shop').set(auth(booster));
    expect(shop.body.items.find((i: { code: string }) => i.code === 'xp_boost').owned).toBe(0);
  });

  it('Streak Freeze saves a broken streak and is consumed', async () => {
    // Pretend this user had a 5-day streak that last ran 3 days ago.
    await setCoins(freezer.id, 100);
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    await pool.query('UPDATE user_stats SET streak_days=5, last_run_date=$1 WHERE user_id=$2', [
      threeDaysAgo,
      freezer.id,
    ]);
    expect((await request(app).post('/shop/streak_freeze/buy').set(auth(freezer))).status).toBe(200);

    // A run today would normally reset the streak to 1 (gap of >1 day).
    const rep = await request(app)
      .post('/runs')
      .set(auth(freezer))
      .send(syntheticRun(800, 600, new Date().toISOString()));
    expect(rep.status).toBe(201);
    expect(rep.body.perksApplied).toContain('Streak Freeze');
    expect(rep.body.stats.streakDays).toBe(6); // continued, not reset

    const shop = await request(app).get('/shop').set(auth(freezer));
    expect(shop.body.items.find((i: { code: string }) => i.code === 'streak_freeze').owned).toBe(0);
  });
});
