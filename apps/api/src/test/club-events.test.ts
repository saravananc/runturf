import type { ClubEvent } from '@runturf/shared';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);
const clubTag = tag.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');

async function makeUser(name: string): Promise<{ token: string; id: string; username: string }> {
  const username = `tce_${tag}_${name}`;
  const res = await request(app).post('/auth/register').send({ username, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id, username };
}

const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

let owner: Awaited<ReturnType<typeof makeUser>>;
let member: Awaited<ReturnType<typeof makeUser>>;
let outsider: Awaited<ReturnType<typeof makeUser>>;
let clubId = '';

const listEvents = async (u: { token: string }): Promise<ClubEvent[]> => {
  const res = await request(app).get(`/clubs/${clubId}/events`).set(auth(u));
  expect(res.status).toBe(200);
  return res.body;
};

beforeAll(async () => {
  [owner, member, outsider] = await Promise.all([
    makeUser('owner'),
    makeUser('member'),
    makeUser('outsider'),
  ]);
  const res = await request(app)
    .post('/clubs')
    .set(auth(owner))
    .send({ name: `Event Club ${tag}`, tag: clubTag });
  expect(res.status).toBe(201);
  clubId = res.body.id;
  expect((await request(app).post(`/clubs/${clubId}/join`).set(auth(member))).status).toBe(201);
});

afterAll(async () => {
  await pool.query('DELETE FROM clubs WHERE name LIKE $1', [`Event Club ${tag}%`]);
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tce\\_${tag}%`]);
  await pool.end();
});

describe('club events', () => {
  let eventId = '';

  it('only the owner can schedule an event', async () => {
    const res = await request(app)
      .post(`/clubs/${clubId}/events`)
      .set(auth(member))
      .send({ title: 'Members cannot do this', startsAt: inDays(3) });
    expect(res.status).toBe(403);
  });

  it('owner schedules an event', async () => {
    const res = await request(app)
      .post(`/clubs/${clubId}/events`)
      .set(auth(owner))
      .send({
        title: 'Saturday long run',
        description: 'Easy 10k, coffee after',
        location: 'Riverside gate',
        startsAt: inDays(3),
      });
    expect(res.status).toBe(201);
    const event = res.body as ClubEvent;
    eventId = event.id;
    expect(event.title).toBe('Saturday long run');
    expect(event.location).toBe('Riverside gate');
    expect(event.cancelled).toBe(false);
    expect(event.goingCount).toBe(0); // nobody has answered yet
    expect(event.myRsvp).toBeNull();
    expect(event.createdBy.username).toBe(owner.username);
  });

  it('rejects an event in the past or with a too-short title', async () => {
    const past = await request(app)
      .post(`/clubs/${clubId}/events`)
      .set(auth(owner))
      .send({ title: 'Yesterday run', startsAt: inDays(-1) });
    expect(past.status).toBe(400);

    const short = await request(app)
      .post(`/clubs/${clubId}/events`)
      .set(auth(owner))
      .send({ title: 'no', startsAt: inDays(2) });
    expect(short.status).toBe(400);
  });

  it('hides events from non-members', async () => {
    expect((await request(app).get(`/clubs/${clubId}/events`).set(auth(outsider))).status).toBe(403);
    const rsvp = await request(app)
      .post(`/clubs/events/${eventId}/rsvp`)
      .set(auth(outsider))
      .send({ going: true });
    expect(rsvp.status).toBe(403);
  });

  it('members RSVP, and the count reflects only those going', async () => {
    expect(
      (await request(app).post(`/clubs/events/${eventId}/rsvp`).set(auth(member)).send({ going: true }))
        .status,
    ).toBe(200);

    let events = await listEvents(member);
    expect(events[0].goingCount).toBe(1);
    expect(events[0].myRsvp).toBe(true);
    // The owner sees the same count but their own answer is still unset.
    expect((await listEvents(owner))[0].myRsvp).toBeNull();

    // Changing the answer to "not going" upserts rather than duplicating.
    expect(
      (
        await request(app)
          .post(`/clubs/events/${eventId}/rsvp`)
          .set(auth(member))
          .send({ going: false })
      ).status,
    ).toBe(200);
    events = await listEvents(member);
    expect(events[0].goingCount).toBe(0);
    expect(events[0].myRsvp).toBe(false);
  });

  it('lists events soonest first', async () => {
    const later = await request(app)
      .post(`/clubs/${clubId}/events`)
      .set(auth(owner))
      .send({ title: 'Next month track night', startsAt: inDays(30) });
    expect(later.status).toBe(201);

    const events = await listEvents(owner);
    expect(events.map((e) => e.title)).toEqual(['Saturday long run', 'Next month track night']);
  });

  it('owner cancels an event; it stays visible but blocks RSVPs', async () => {
    const notOwner = await request(app).delete(`/clubs/events/${eventId}`).set(auth(member));
    expect(notOwner.status).toBe(403);

    expect((await request(app).delete(`/clubs/events/${eventId}`).set(auth(owner))).status).toBe(204);

    const events = await listEvents(member);
    const cancelled = events.find((e) => e.id === eventId);
    expect(cancelled?.cancelled).toBe(true); // kept, so members see it was called off

    const rsvp = await request(app)
      .post(`/clubs/events/${eventId}/rsvp`)
      .set(auth(member))
      .send({ going: true });
    expect(rsvp.status).toBe(400);

    // Cancelling twice is a conflict, not a silent no-op.
    expect((await request(app).delete(`/clubs/events/${eventId}`).set(auth(owner))).status).toBe(409);
  });
});
