import { randomUUID } from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { weekBounds } from '@runturf/shared';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { ensureWeeklyChallenges, WEEKLY_TEMPLATES } from '../services/challenges.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);

async function makeUser(): Promise<string> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `tch_${tag}`, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tch\\_${tag}%`]);
  await pool.end();
});

describe('weekly challenge lifecycle', () => {
  it('generates the current week on read, even if the seeded week has expired', async () => {
    const token = await makeUser();
    const { tag: weekTag } = weekBounds();

    const res = await request(app).get('/challenges').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Before this fix, an expired seed week meant an empty list forever.
    expect(res.body.length).toBe(WEEKLY_TEMPLATES.length);
    for (const t of WEEKLY_TEMPLATES) {
      expect(res.body.map((c: { code: string }) => c.code)).toContain(`${t.slug}_${weekTag}`);
    }
  });

  it('returns challenges that are actually active now', async () => {
    const token = await makeUser().catch(() =>
      request(app)
        .post('/auth/login')
        .send({ username: `tch_${tag}`, password: 'password123' })
        .then((r) => r.body.accessToken as string),
    );
    const res = await request(app).get('/challenges').set('Authorization', `Bearer ${token}`);
    const now = Date.now();
    for (const c of res.body) {
      expect(new Date(c.startsAt).getTime()).toBeLessThanOrEqual(now);
      expect(new Date(c.endsAt).getTime()).toBeGreaterThan(now);
    }
  });

  it('is idempotent — repeated generation never duplicates', async () => {
    await Promise.all([
      ensureWeeklyChallenges(),
      ensureWeeklyChallenges(),
      ensureWeeklyChallenges(),
    ]);
    const { rows } = await pool.query(
      'SELECT code, count(*)::int AS n FROM challenges GROUP BY code HAVING count(*) > 1',
    );
    expect(rows).toEqual([]);
  });

  it('generates a distinct set for a different week', async () => {
    const nextWeek = new Date(Date.now() + 7 * 86_400_000);
    await ensureWeeklyChallenges(nextWeek);
    const { tag: thisTag } = weekBounds();
    const { tag: nextTag } = weekBounds(nextWeek);
    expect(nextTag).not.toBe(thisTag);

    const { rows } = await pool.query('SELECT code FROM challenges WHERE code LIKE $1', [
      `%_${nextTag}`,
    ]);
    expect(rows.length).toBe(WEEKLY_TEMPLATES.length);

    // clean up the future week so it cannot leak into other tests
    await pool.query('DELETE FROM challenges WHERE code LIKE $1', [`%_${nextTag}`]);
  });
});
