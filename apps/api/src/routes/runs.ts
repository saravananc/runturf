import { Router } from 'express';
import { z } from 'zod';
import { h, idParam, parseBody, requireAuth } from '../middleware.js';
import { deleteRun, getRun, listRuns, submitRun } from '../services/runs.js';

const RunSubmit = z.object({
  startedAt: z.string(),
  points: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        t: z.number().positive(),
        acc: z.number().nonnegative().optional(),
      }),
    )
    .min(2)
    .max(100_000),
  pausedMs: z.number().nonnegative().optional(),
});

export const runsRouter = Router();
runsRouter.use(requireAuth);

runsRouter.post(
  '/',
  h(async (req, res) => {
    res.status(201).json(await submitRun(req.userId, parseBody(RunSubmit, req.body)));
  }),
);

runsRouter.get(
  '/',
  h(async (req, res) => {
    res.json(await listRuns(req.userId));
  }),
);

runsRouter.get(
  '/:id',
  h(async (req, res) => {
    res.json(await getRun(req.userId, idParam(req.params.id)));
  }),
);

runsRouter.delete(
  '/:id',
  h(async (req, res) => {
    await deleteRun(req.userId, idParam(req.params.id));
    res.status(204).end();
  }),
);

runsRouter.get(
  '/:id/gpx',
  h(async (req, res) => {
    const run = await getRun(req.userId, idParam(req.params.id));
    const date = run.startedAt.slice(0, 10);
    res
      .type('application/gpx+xml')
      .setHeader('Content-Disposition', `attachment; filename="runturf-${date}.gpx"`)
      .send(toGpx(run));
  }),
);

function toGpx(run: { startedAt: string; points: { lat: number; lng: number; t: number }[] }) {
  const trkpts = run.points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.t).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunTurf" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>RunTurf run ${run.startedAt}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}
