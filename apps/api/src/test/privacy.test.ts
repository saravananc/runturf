import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 6);

const baseLat = 55 + Math.random() * 5;
const baseLng = -120 - Math.random() * 10;

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

async function makeUser(name: string): Promise<{ token: string; id: string; username: string }> {
  const username = `tpv_${tag}_${name}`;
  const res = await request(app).post('/auth/register').send({ username, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id, username };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function befriend(a: { token: string; id: string }, b: { token: string; username: string }) {
  expect(
    (await request(app).post('/social/requests').set(auth(a.token)).send({ username: b.username }))
      .status,
  ).toBe(201);
  const reqs = (await request(app).get('/social/requests').set(auth(b.token))).body as {
    id: string;
    direction: string;
    user: { id: string };
  }[];
  const incoming = reqs.find((r) => r.direction === 'incoming' && r.user.id === a.id);
  expect(incoming).toBeTruthy();
  await request(app).post(`/social/requests/${incoming!.id}/accept`).set(auth(b.token));
}

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tpv\\_${tag}%`]);
  await pool.end();
});

describe('privacy', () => {
  it('exposes and updates the user’s own settings', async () => {
    const u = await makeUser('settings');
    const before = await request(app).get('/users/me/settings').set(auth(u.token));
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ shareActivity: true, discoverable: true });

    await request(app)
      .patch('/users/me')
      .set(auth(u.token))
      .send({ shareActivity: false, discoverable: false });
    const after = await request(app).get('/users/me/settings').set(auth(u.token));
    expect(after.body).toEqual({ shareActivity: false, discoverable: false });
  });

  it('hides non-discoverable users from search', async () => {
    const seeker = await makeUser('seeker');
    const hidden = await makeUser('hideme');
    const q = hidden.username;

    const found = (await request(app).get(`/social/search?q=${q}`).set(auth(seeker.token))).body;
    expect(found.some((u: { id: string }) => u.id === hidden.id)).toBe(true);

    await request(app).patch('/users/me').set(auth(hidden.token)).send({ discoverable: false });
    const after = (await request(app).get(`/social/search?q=${q}`).set(auth(seeker.token))).body;
    expect(after.some((u: { id: string }) => u.id === hidden.id)).toBe(false);
  });

  it('hides a non-sharing friend’s runs from the feed, but keeps your own', async () => {
    const viewer = await makeUser('viewer');
    const sharer = await makeUser('sharer');
    await befriend(viewer, sharer);

    expect((await request(app).post('/runs').set(auth(sharer.token)).send(lane(0))).status).toBe(201);
    expect((await request(app).post('/runs').set(auth(viewer.token)).send(lane(300))).status).toBe(
      201,
    );

    const has = (feed: { user: { id: string } }[], id: string) => feed.some((f) => f.user.id === id);

    let feed = (await request(app).get('/social/feed').set(auth(viewer.token))).body;
    expect(has(feed, sharer.id)).toBe(true); // friend shares by default
    expect(has(feed, viewer.id)).toBe(true); // own run

    await request(app).patch('/users/me').set(auth(sharer.token)).send({ shareActivity: false });
    feed = (await request(app).get('/social/feed').set(auth(viewer.token))).body;
    expect(has(feed, sharer.id)).toBe(false); // hidden after opting out
    expect(has(feed, viewer.id)).toBe(true); // own run still shown
  });
});
