import { Router } from 'express';
import { z } from 'zod';
import { h, parseBody, requireAuth } from '../middleware.js';
import { territoryInBBox, territoryLeaderboard } from '../services/territory.js';

const BBoxQuery = z.object({
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
});

export const territoryRouter = Router();
territoryRouter.use(requireAuth);

territoryRouter.get(
  '/',
  h(async (req, res) => {
    const bbox = parseBody(BBoxQuery, req.query);
    res.json(await territoryInBBox(bbox));
  }),
);

territoryRouter.get(
  '/leaderboard',
  h(async (_req, res) => {
    res.json(await territoryLeaderboard());
  }),
);
