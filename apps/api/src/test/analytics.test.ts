import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);

// Every event carries this tag in props so the suite can find and clean up
// exactly its own rows, including anonymous ones with no user to key on.
const ev = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  props: { tag, ...extra },
});

async function makeUser(name: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `tan_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const rowsForTag = () =>
  pool.query(`SELECT name, user_id, source, props FROM analytics_events WHERE props->>'tag' = $1`, [
    tag,
  ]);

let user: { token: string; id: string };

beforeAll(async () => {
  user = await makeUser('u');
});

afterAll(async () => {
  await pool.query(`DELETE FROM analytics_events WHERE props->>'tag' = $1`, [tag]);
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tan\\_${tag}%`]);
  await pool.end();
});

describe('POST /events', () => {
  it('accepts an anonymous batch and stores it with a null user', async () => {
    const res = await request(app)
      .post('/events')
      .send({ source: 'web', events: [ev('app_opened')] });
    expect(res.status).toBe(202);
    expect(res.body.recorded).toBe(1);

    const { rows } = await rowsForTag();
    const opened = rows.find((r) => r.name === 'app_opened');
    expect(opened).toBeTruthy();
    expect(opened.user_id).toBeNull();
    expect(opened.source).toBe('web');
  });

  it('attributes the batch to the signed-in user from the token, not the body', async () => {
    const res = await request(app)
      .post('/events')
      .set(auth(user.token))
      .send({ source: 'mobile', events: [ev('run_submitted', { distanceM: 1200 })] });
    expect(res.status).toBe(202);

    const { rows } = await rowsForTag();
    const run = rows.find((r) => r.name === 'run_submitted');
    expect(run.user_id).toBe(user.id);
    expect(run.source).toBe('mobile');
    expect(run.props.distanceM).toBe(1200);
  });

  it('ignores an invalid token rather than failing (stays anonymous)', async () => {
    const res = await request(app)
      .post('/events')
      .set({ Authorization: 'Bearer not-a-real-token' })
      .send({ source: 'web', events: [ev('user_signed_in')] });
    expect(res.status).toBe(202);
    const { rows } = await rowsForTag();
    expect(rows.find((r) => r.name === 'user_signed_in').user_id).toBeNull();
  });

  it('rejects an unknown event name', async () => {
    const res = await request(app)
      .post('/events')
      .send({ source: 'web', events: [{ name: 'definitely_not_an_event', props: { tag } }] });
    expect(res.status).toBe(400);
  });

  it('rejects an empty batch and an unknown source', async () => {
    expect((await request(app).post('/events').send({ source: 'web', events: [] })).status).toBe(400);
    expect(
      (await request(app).post('/events').send({ source: 'desktop', events: [ev('app_opened')] }))
        .status,
    ).toBe(400);
  });
});
