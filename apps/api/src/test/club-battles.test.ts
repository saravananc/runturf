import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 6);

// Remote ocean lanes so captures never collide with other suites.
const baseLat = -70 - Math.random() * 5;
const baseLng = 150 + Math.random() * 10;

function lane(offsetNorthM: number, meters: number) {
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
    .send({ username: `tbt_${tag}_${name}`, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken, id: res.body.user.id };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function createClub(token: string, suffix: string): Promise<string> {
  const res = await request(app)
    .post('/clubs')
    .set(auth(token))
    .send({ name: `Battle ${tag} ${suffix}`, tag: `${tag.slice(0, 3)}${suffix}`.toUpperCase() });
  expect(res.status).toBe(201);
  return res.body.id;
}

const join = (token: string, clubId: string) =>
  request(app).post(`/clubs/${clubId}/join`).set(auth(token));
const submit = (token: string, l: ReturnType<typeof lane>) =>
  request(app).post('/runs').set(auth(token)).send(l);
const coinsOf = async (id: string) =>
  (await pool.query('SELECT coins FROM user_stats WHERE user_id=$1', [id])).rows[0].coins as number;
const battlesFor = (token: string, clubId: string) =>
  request(app).get(`/clubs/${clubId}/battles`).set(auth(token));

let ownerA: { token: string; id: string };
let memberA: { token: string; id: string };
let ownerB: { token: string; id: string };
let memberB: { token: string; id: string };
let outsider: { token: string; id: string };
let clubA: string;
let clubB: string;
// A separate pair for the finish test — the clubA↔clubB battle stays open, and
// only one battle per club pair may be open at a time.
let ownerC: { token: string; id: string };
let ownerD: { token: string; id: string };
let capC: { token: string; id: string };
let capD: { token: string; id: string };
let clubC: string;
let clubD: string;

beforeAll(async () => {
  [ownerA, memberA, ownerB, memberB, outsider, ownerC, ownerD, capC, capD] = await Promise.all([
    makeUser('oa'),
    makeUser('ma'),
    makeUser('ob'),
    makeUser('mb'),
    makeUser('out'),
    makeUser('oc'),
    makeUser('od'),
    makeUser('cc'),
    makeUser('cd'),
  ]);
  clubA = await createClub(ownerA.token, 'A');
  clubB = await createClub(ownerB.token, 'B');
  clubC = await createClub(ownerC.token, 'C');
  clubD = await createClub(ownerD.token, 'D');
  await Promise.all([
    join(memberA.token, clubA),
    join(memberB.token, clubB),
    join(capC.token, clubC),
    join(capD.token, clubD),
  ]);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tbt\\_${tag}%`]);
  await pool.end();
});

describe('club battles', () => {
  it('only a club owner can propose, and only against another club', async () => {
    expect(
      (await request(app).post('/clubs/battles').set(auth(memberA.token)).send({
        opponentClubId: clubB,
        durationHours: 24,
      })).status,
    ).toBe(403); // a member, not an owner

    expect(
      (await request(app).post('/clubs/battles').set(auth(ownerA.token)).send({
        opponentClubId: clubA,
        durationHours: 24,
      })).status,
    ).toBe(400); // cannot battle your own club
  });

  it('propose → the challenged owner accepts → the battle goes active', async () => {
    const proposed = await request(app)
      .post('/clubs/battles')
      .set(auth(ownerA.token))
      .send({ opponentClubId: clubB, durationHours: 24 });
    expect(proposed.status).toBe(201);
    expect(proposed.body.status).toBe('proposed');
    const battleId = proposed.body.id;

    // A second proposal while one is open is rejected.
    expect(
      (await request(app).post('/clubs/battles').set(auth(ownerA.token)).send({
        opponentClubId: clubB,
        durationHours: 24,
      })).status,
    ).toBe(409);

    // Only the challenged club's owner may respond.
    expect(
      (await request(app)
        .post(`/clubs/battles/${battleId}/respond`)
        .set(auth(outsider.token))
        .send({ accept: true })).status,
    ).toBe(403);

    const accepted = await request(app)
      .post(`/clubs/battles/${battleId}/respond`)
      .set(auth(ownerB.token))
      .send({ accept: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('active');
    expect(accepted.body.startsAt).toBeTruthy();
    expect(accepted.body.endsAt).toBeTruthy();
  });

  it('shows a live score from members’ captures while active', async () => {
    // The active battle from the previous test is running; memberA captures turf.
    const run = await submit(memberA.token, lane(0, 400));
    expect(run.status).toBe(201);
    const captured = run.body.run.cellsCaptured as number;
    expect(captured).toBeGreaterThan(0);

    const list = await battlesFor(ownerA.token, clubA);
    expect(list.status).toBe(200);
    const active = list.body.find((b: { status: string }) => b.status === 'active');
    // clubA is the challenger; its live score reflects memberA's fresh captures.
    expect(active.challengerScore).toBe(captured);
    expect(active.opponentScore).toBe(0);
  });

  it('finishes a closed battle: freezes the score, picks a winner, pays the winners', async () => {
    // clubC challenges clubD; clubD's owner accepts.
    const proposed = await request(app)
      .post('/clubs/battles')
      .set(auth(ownerC.token))
      .send({ opponentClubId: clubD, durationHours: 24 });
    const battleId = proposed.body.id;
    await request(app)
      .post(`/clubs/battles/${battleId}/respond`)
      .set(auth(ownerD.token))
      .send({ accept: true });

    // Both sides capture on separate lanes; challenger (clubC) runs further.
    const cRun = await submit(capC.token, lane(1200, 600));
    const dRun = await submit(capD.token, lane(1600, 200));
    const cCells = cRun.body.run.cellsCaptured as number;
    const dCells = dRun.body.run.cellsCaptured as number;
    expect(cCells).toBeGreaterThan(dCells);

    // Move the window into the past and pull both sides' captures inside it.
    await pool.query(
      `UPDATE club_battles SET starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour' WHERE id=$1`,
      [battleId],
    );
    for (const id of [capC.id, capD.id]) {
      await pool.query(
        `UPDATE cell_captures SET captured_at=now()-interval '90 minutes' WHERE new_owner_id=$1`,
        [id],
      );
    }

    const winnerBefore = await coinsOf(capC.id);
    const loserBefore = await coinsOf(capD.id);

    // Listing settles due battles.
    const list = await battlesFor(ownerC.token, clubC);
    const finished = list.body.find((b: { id: string }) => b.id === battleId);
    expect(finished.status).toBe('finished');
    expect(finished.challengerScore).toBe(cCells); // clubC proposed → challenger
    expect(finished.opponentScore).toBe(dCells);
    expect(finished.winnerClubId).toBe(clubC);

    // Winning club members earned coins; the losing side did not.
    expect(await coinsOf(capC.id)).toBe(winnerBefore + 100);
    expect(await coinsOf(capD.id)).toBe(loserBefore);

    // Idempotent: settling again does not pay a second time.
    await battlesFor(ownerC.token, clubC);
    expect(await coinsOf(capC.id)).toBe(winnerBefore + 100);
  });
});
