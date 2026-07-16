import { randomUUID } from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);
const uname = `ta_${tag}`;

afterAll(async () => {
  // Only delete THIS file's users — other test files run in parallel.
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`ta\\_${tag}%`]);
  await pool.end();
});

describe('auth flow', () => {
  let accessToken = '';
  let refreshToken = '';

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: uname, password: 'password123', displayName: 'Tester' });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe(uname);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects duplicate usernames', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: uname, password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid usernames and short passwords', async () => {
    expect(
      (await request(app).post('/auth/register').send({ username: 'x', password: 'password123' }))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/auth/register')
          .send({ username: `ta_${tag}ok`, password: 'short' })
      ).status,
    ).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: uname, password: 'password123' });
    expect(res.status).toBe(200);
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: uname, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(uname);
  });

  it('rejects missing/garbage tokens', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/auth/me').set('Authorization', 'Bearer garbage')).status,
    ).toBe(401);
  });

  it('rotates refresh tokens: new pair works, old token dies', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('updates the profile', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Renamed', color: '#ff0000' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Renamed');
    expect(res.body.color).toBe('#ff0000');
  });

  it('returns fresh user stats', async () => {
    const res = await request(app)
      .get('/users/me/stats')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ xp: 0, level: 1, coins: 0, totalRuns: 0, cellsOwned: 0 });
  });
});
