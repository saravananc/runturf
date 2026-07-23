import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);
const clubTag = tag.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');

async function makeUser(name: string): Promise<{ token: string; id: string; username: string }> {
  const username = `tci_${tag}_${name}`;
  const res = await request(app).post('/auth/register').send({ username, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id, username };
}

const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });

let owner: Awaited<ReturnType<typeof makeUser>>;
let alice: Awaited<ReturnType<typeof makeUser>>;
let bob: Awaited<ReturnType<typeof makeUser>>;
let clubId = '';

beforeAll(async () => {
  [owner, alice, bob] = await Promise.all([
    makeUser('owner'),
    makeUser('alice'),
    makeUser('bob'),
  ]);
  const res = await request(app)
    .post('/clubs')
    .set(auth(owner))
    .send({ name: `Invite Club ${tag}`, tag: clubTag });
  expect(res.status).toBe(201);
  clubId = res.body.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM clubs WHERE name LIKE $1', [`Invite Club ${tag}%`]);
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tci\\_${tag}%`]);
  await pool.end();
});

describe('club invites', () => {
  let inviteId = '';

  it('only the owner can invite', async () => {
    const notOwner = await request(app)
      .post(`/clubs/${clubId}/invites`)
      .set(auth(alice))
      .send({ username: bob.username });
    expect(notOwner.status).toBe(403);
  });

  it('owner invites a user by username', async () => {
    const res = await request(app)
      .post(`/clubs/${clubId}/invites`)
      .set(auth(owner))
      .send({ username: alice.username });
    expect(res.status).toBe(201);
  });

  it('the invitee sees the pending invite', async () => {
    const res = await request(app).get('/clubs/invites').set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].club.id).toBe(clubId);
    expect(res.body[0].inviter.username).toBe(owner.username);
    inviteId = res.body[0].id;
  });

  it('a stranger cannot accept someone else’s invite', async () => {
    const res = await request(app).post(`/clubs/invites/${inviteId}/accept`).set(auth(bob));
    expect(res.status).toBe(404);
  });

  it('accepting the invite joins the club and clears it', async () => {
    const res = await request(app).post(`/clubs/invites/${inviteId}/accept`).set(auth(alice));
    expect(res.status).toBe(200);

    const mine = await request(app).get('/clubs/mine').set(auth(alice));
    expect(mine.body.id).toBe(clubId);
    expect(mine.body.memberCount).toBe(2);

    // invite is gone
    expect((await request(app).get('/clubs/invites').set(auth(alice))).body).toHaveLength(0);
  });

  it('declining removes the invite without joining', async () => {
    await request(app).post(`/clubs/${clubId}/invites`).set(auth(owner)).send({ username: bob.username });
    const list = await request(app).get('/clubs/invites').set(auth(bob));
    const id = list.body[0].id;

    expect((await request(app).post(`/clubs/invites/${id}/decline`).set(auth(bob))).status).toBe(200);
    expect((await request(app).get('/clubs/invites').set(auth(bob))).body).toHaveLength(0);
    expect((await request(app).get('/clubs/mine').set(auth(bob))).body).toBeNull();
  });
});

describe('club moderation', () => {
  it('owner transfers ownership; roles swap', async () => {
    // alice joined above; make her the owner.
    const res = await request(app)
      .post(`/clubs/${clubId}/transfer`)
      .set(auth(owner))
      .send({ userId: alice.id });
    expect(res.status).toBe(200);

    const detail = await request(app).get(`/clubs/${clubId}`).set(auth(alice));
    expect(detail.body.ownerId).toBe(alice.id);
    expect(detail.body.myRole).toBe('owner');
    const oldOwner = detail.body.members.find((m: { id: string }) => m.id === owner.id);
    expect(oldOwner.role).toBe('member');
  });

  it('the former owner can no longer moderate', async () => {
    const res = await request(app)
      .delete(`/clubs/${clubId}/members/${owner.id}`)
      .set(auth(owner)); // owner is now a plain member
    expect(res.status).toBe(403);
  });

  it('new owner kicks a member', async () => {
    // alice (owner) kicks the former owner.
    const res = await request(app)
      .delete(`/clubs/${clubId}/members/${owner.id}`)
      .set(auth(alice));
    expect(res.status).toBe(204);

    const detail = await request(app).get(`/clubs/${clubId}`).set(auth(alice));
    expect(detail.body.memberCount).toBe(1);
    expect(detail.body.members.map((m: { id: string }) => m.id)).not.toContain(owner.id);
    // kicked user is now club-less
    expect((await request(app).get('/clubs/mine').set(auth(owner))).body).toBeNull();
  });

  it('owner cannot kick themselves', async () => {
    const res = await request(app)
      .delete(`/clubs/${clubId}/members/${alice.id}`)
      .set(auth(alice));
    expect(res.status).toBe(400);
  });
});
