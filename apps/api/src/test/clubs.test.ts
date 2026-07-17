import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);
const clubTag = tag.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');

async function makeUser(name: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `tc_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

let owner: { token: string; id: string };
let member: { token: string; id: string };
let outsider: { token: string; id: string };
let clubId = '';

beforeAll(async () => {
  [owner, member, outsider] = await Promise.all([
    makeUser('owner'),
    makeUser('member'),
    makeUser('out'),
  ]);
});

afterAll(async () => {
  await pool.query('DELETE FROM clubs WHERE name LIKE $1', [`Test Club ${tag}%`]);
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tc\\_${tag}%`]);
  await pool.end();
});

const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });

describe('clubs', () => {
  it('creates a club; creator becomes owner', async () => {
    const res = await request(app)
      .post('/clubs')
      .set(auth(owner))
      .send({ name: `Test Club ${tag}`, tag: clubTag, description: 'For testing' });
    expect(res.status).toBe(201);
    expect(res.body.myRole).toBe('owner');
    expect(res.body.memberCount).toBe(1);
    clubId = res.body.id;
  });

  it('rejects a second club for the same user and duplicate names', async () => {
    const again = await request(app)
      .post('/clubs')
      .set(auth(owner))
      .send({ name: `Test Club ${tag} 2`, tag: 'ZZZZ' });
    expect(again.status).toBe(409);

    const dupName = await request(app)
      .post('/clubs')
      .set(auth(member))
      .send({ name: `Test Club ${tag}`, tag: 'YYYY' });
    expect(dupName.status).toBe(409);
  });

  it('lists and finds the club', async () => {
    const res = await request(app).get(`/clubs?q=${clubTag}`).set(auth(member));
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string }) => c.id)).toContain(clubId);
  });

  it('lets another user join, and /clubs/mine reflects it', async () => {
    const res = await request(app).post(`/clubs/${clubId}/join`).set(auth(member));
    expect(res.status).toBe(201);
    const mine = await request(app).get('/clubs/mine').set(auth(member));
    expect(mine.body.id).toBe(clubId);
    expect(mine.body.memberCount).toBe(2);
    expect(mine.body.myRole).toBe('member');
  });

  it('club chat: members can post and read, outsiders cannot', async () => {
    const post = await request(app)
      .post(`/clubs/${clubId}/messages`)
      .set(auth(owner))
      .send({ body: 'Welcome to the club! 🏃' });
    expect(post.status).toBe(201);

    const list = await request(app).get(`/clubs/${clubId}/messages`).set(auth(member));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].body).toContain('Welcome');

    const blockedRead = await request(app).get(`/clubs/${clubId}/messages`).set(auth(outsider));
    expect(blockedRead.status).toBe(403);
    const blockedPost = await request(app)
      .post(`/clubs/${clubId}/messages`)
      .set(auth(outsider))
      .send({ body: 'hi' });
    expect(blockedPost.status).toBe(403);
  });

  it('owner leaving transfers ownership to the oldest member', async () => {
    const res = await request(app).post('/clubs/leave').set(auth(owner));
    expect(res.status).toBe(200);
    const detail = await request(app).get(`/clubs/${clubId}`).set(auth(member));
    expect(detail.body.ownerId).toBe(member.id);
    expect(detail.body.myRole).toBe('owner');
    expect(detail.body.memberCount).toBe(1);
  });

  it('last member leaving deletes the club', async () => {
    const res = await request(app).post('/clubs/leave').set(auth(member));
    expect(res.status).toBe(200);
    const detail = await request(app).get(`/clubs/${clubId}`).set(auth(member));
    expect(detail.status).toBe(404);
  });
});
