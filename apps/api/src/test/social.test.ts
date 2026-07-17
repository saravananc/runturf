import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);

const baseLat = -20 - Math.random() * 5;
const baseLng = -120 - Math.random() * 10;

function syntheticRun(meters = 400) {
  const start = Date.now() - 1_800_000;
  const points = [];
  for (let d = 0; d <= meters; d += 10) {
    points.push({
      lat: baseLat,
      lng: baseLng + d / (111_320 * Math.cos((baseLat * Math.PI) / 180)),
      t: start + (d / 3) * 1000,
    });
  }
  return { startedAt: new Date(start).toISOString(), points };
}

async function makeUser(name: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `ts_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

let ana: { token: string; id: string };
let ben: { token: string; id: string };
let cara: { token: string; id: string };

beforeAll(async () => {
  [ana, ben, cara] = await Promise.all([makeUser('ana'), makeUser('ben'), makeUser('cara')]);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`ts\\_${tag}%`]);
  await pool.end();
});

const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });

describe('friends', () => {
  let requestId = '';

  it('searches users by name', async () => {
    const res = await request(app).get(`/social/search?q=ts_${tag}_b`).set(auth(ana));
    expect(res.status).toBe(200);
    expect(res.body.map((u: { username: string }) => u.username)).toContain(`ts_${tag}_ben`);
  });

  it('sends a friend request', async () => {
    const res = await request(app)
      .post('/social/requests')
      .set(auth(ana))
      .send({ username: `ts_${tag}_ben` });
    expect(res.status).toBe(201);

    const dup = await request(app)
      .post('/social/requests')
      .set(auth(ana))
      .send({ username: `ts_${tag}_ben` });
    expect(dup.status).toBe(409);

    const selfReq = await request(app)
      .post('/social/requests')
      .set(auth(ana))
      .send({ username: `ts_${tag}_ana` });
    expect(selfReq.status).toBe(400);
  });

  it('shows the request to both sides', async () => {
    const forBen = await request(app).get('/social/requests').set(auth(ben));
    expect(forBen.body).toHaveLength(1);
    expect(forBen.body[0].direction).toBe('incoming');
    expect(forBen.body[0].user.username).toBe(`ts_${tag}_ana`);
    requestId = forBen.body[0].id;

    const forAna = await request(app).get('/social/requests').set(auth(ana));
    expect(forAna.body[0].direction).toBe('outgoing');
  });

  it('only the addressee can accept', async () => {
    const wrong = await request(app).post(`/social/requests/${requestId}/accept`).set(auth(cara));
    expect(wrong.status).toBe(404);
    const ok = await request(app).post(`/social/requests/${requestId}/accept`).set(auth(ben));
    expect(ok.status).toBe(200);
  });

  it('lists friends for both users', async () => {
    const anaFriends = await request(app).get('/social/friends').set(auth(ana));
    expect(anaFriends.body.map((f: { user: { id: string } }) => f.user.id)).toContain(ben.id);
    const benFriends = await request(app).get('/social/friends').set(auth(ben));
    expect(benFriends.body.map((f: { user: { id: string } }) => f.user.id)).toContain(ana.id);
  });

  it("feed shows own and friends' runs but not strangers'", async () => {
    expect((await request(app).post('/runs').set(auth(ben)).send(syntheticRun())).status).toBe(201);
    expect(
      (await request(app).post('/runs').set(auth(cara)).send(syntheticRun(200))).status,
    ).toBe(201);

    const feed = await request(app).get('/social/feed').set(auth(ana));
    expect(feed.status).toBe(200);
    const userIds = feed.body.map((i: { user: { id: string } }) => i.user.id);
    expect(userIds).toContain(ben.id);
    expect(userIds).not.toContain(cara.id);
  });

  it('unfriends and the feed empties', async () => {
    const res = await request(app).delete(`/social/friends/${ben.id}`).set(auth(ana));
    expect(res.status).toBe(204);
    const feed = await request(app).get('/social/feed').set(auth(ana));
    expect(feed.body.map((i: { user: { id: string } }) => i.user.id)).not.toContain(ben.id);
  });
});

describe('gpx export', () => {
  it('exports a run as GPX with track points', async () => {
    const list = await request(app).get('/runs').set(auth(ben));
    const gpx = await request(app).get(`/runs/${list.body[0].id}/gpx`).set(auth(ben));
    expect(gpx.status).toBe(200);
    expect(gpx.headers['content-type']).toContain('gpx');
    expect(gpx.text).toContain('<gpx');
    expect((gpx.text.match(/<trkpt /g) ?? []).length).toBeGreaterThan(30);
  });
});
