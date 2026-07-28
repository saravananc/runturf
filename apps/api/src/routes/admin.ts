import { count, eq } from 'drizzle-orm';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/client.js';
import { clubBattles, runs, territoryCells, users } from '../db/schema.js';
import { forbidden } from '../errors.js';
import { h, idParam, requireAuth } from '../middleware.js';
import { decayTerritory } from '../services/territory.js';

/** Gate for site admins. Enforces the global `users.role` column. */
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  db.query.users
    .findFirst({ where: eq(users.id, req.userId) })
    .then((user) => {
      if (!user || user.role !== 'admin') throw forbidden('Admin access required');
      next();
    })
    .catch(next);
}

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

/** Site-wide counters for a lightweight admin dashboard. */
adminRouter.get(
  '/overview',
  h(async (_req, res) => {
    const [[u], [r], [c], [b]] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(runs),
      db.select({ n: count() }).from(territoryCells),
      db.select({ n: count() }).from(clubBattles).where(eq(clubBattles.status, 'active')),
    ]);
    res.json({
      users: Number(u.n),
      runs: Number(r.n),
      cells: Number(c.n),
      activeBattles: Number(b.n),
    });
  }),
);

/** Force a decay sweep now (the read path only sweeps on a throttle). */
adminRouter.post(
  '/territory/decay',
  h(async (_req, res) => {
    res.json({ removed: await decayTerritory() });
  }),
);

/** Moderation: wipe a user's territory (e.g. a caught cheater). */
adminRouter.delete(
  '/users/:id/territory',
  h(async (req, res) => {
    const removed = await db
      .delete(territoryCells)
      .where(eq(territoryCells.ownerId, idParam(req.params.id)))
      .returning({ x: territoryCells.x });
    res.json({ removed: removed.length });
  }),
);
