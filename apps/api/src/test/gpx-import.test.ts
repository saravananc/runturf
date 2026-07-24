import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';

const app = createApp();
const tag = randomUUID().slice(0, 8);

// Untouched ocean so imported captures never collide with other test data.
const baseLat = -60 - Math.random() * 5;
const baseLng = -170 + Math.random() * 5;

/** A GPX document describing a ~600 m eastward jog. */
function makeGpx(startIso: string, meters = 600, lat = baseLat) {
  const start = Date.parse(startIso);
  const pts: string[] = [];
  for (let d = 0; d <= meters; d += 10) {
    const lng = baseLng + d / (111_320 * Math.cos((lat * Math.PI) / 180));
    const t = new Date(start + (d / 3) * 1000).toISOString();
    pts.push(`<trkpt lat="${lat}" lon="${lng}"><time>${t}</time></trkpt>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Morning Run</name><trkseg>${pts.join('')}</trkseg></trk>
</gpx>`;
}

let token = '';

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: `tgpx_${tag}`, password: 'password123' });
  expect(res.status).toBe(201);
  token = res.body.accessToken;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE $1', [`tgpx\\_${tag}%`]);
  await pool.end();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GPX import', () => {
  const startIso = '2026-07-19T06:00:00.000Z';

  it('imports a GPX file as a full run with rewards', async () => {
    const res = await request(app)
      .post('/runs/import')
      .set(auth())
      .send({ gpx: makeGpx(startIso) });
    expect(res.status).toBe(201);

    // Ran through the normal pipeline: distance, capture, XP, achievements.
    expect(res.body.run.distanceM).toBeGreaterThan(550);
    expect(res.body.run.distanceM).toBeLessThan(650);
    expect(res.body.run.cellsCaptured).toBeGreaterThanOrEqual(4);
    expect(res.body.xpGained).toBeGreaterThan(0);
    expect(res.body.newAchievements.map((a: { code: string }) => a.code)).toContain('first_run');
    expect(res.body.run.startedAt).toBe(startIso);
  });

  it('appears in run history', async () => {
    const res = await request(app).get('/runs').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('refuses to import the same run twice', async () => {
    const res = await request(app)
      .post('/runs/import')
      .set(auth())
      .send({ gpx: makeGpx(startIso) });
    expect(res.status).toBe(409);
  });

  it('round-trips: a run exported as GPX can be re-imported', async () => {
    const list = await request(app).get('/runs').set(auth());
    const gpx = await request(app).get(`/runs/${list.body[0].id}/gpx`).set(auth());
    expect(gpx.status).toBe(200);

    // Same start time, so the duplicate guard should reject it — proving the
    // export parses cleanly and identifies the same run.
    const reimport = await request(app).post('/runs/import').set(auth()).send({ gpx: gpx.text });
    expect(reimport.status).toBe(409);
  });

  it('rejects a file that is not GPX', async () => {
    const res = await request(app)
      .post('/runs/import')
      .set(auth())
      .send({ gpx: '<html><body>not a gpx</body></html>' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/GPX/i);
  });

  it('rejects a GPX without timestamps', async () => {
    const res = await request(app)
      .post('/runs/import')
      .set(auth())
      .send({
        gpx: '<gpx><trkseg><trkpt lat="1" lon="1"/><trkpt lat="1.001" lon="1"/></trkseg></gpx>',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timestamp/i);
  });

  it('rejects an implausibly fast track (anti-cheat still applies)', async () => {
    // 600 m of GPS points compressed into 5 seconds.
    const start = Date.parse('2026-07-18T06:00:00.000Z');
    const pts: string[] = [];
    for (let d = 0; d <= 600; d += 10) {
      const lng = baseLng + d / (111_320 * Math.cos((baseLat * Math.PI) / 180));
      pts.push(
        `<trkpt lat="${baseLat}" lon="${lng}"><time>${new Date(start + d * 8).toISOString()}</time></trkpt>`,
      );
    }
    const res = await request(app)
      .post('/runs/import')
      .set(auth())
      .send({ gpx: `<gpx><trk><trkseg>${pts.join('')}</trkseg></trk></gpx>` });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await request(app).post('/runs/import').send({ gpx: makeGpx(startIso) })).status).toBe(
      401,
    );
  });
});
