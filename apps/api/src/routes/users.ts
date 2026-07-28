import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { notFound } from '../errors.js';
import { h, parseBody, requireAuth } from '../middleware.js';
import { toPublic } from '../services/auth.js';
import { getUserStats } from '../services/stats.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

const ProfilePatch = z.object({
  displayName: z.string().min(1).max(48).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  shareActivity: z.boolean().optional(),
  discoverable: z.boolean().optional(),
});

usersRouter.patch(
  '/me',
  h(async (req, res) => {
    const patch = parseBody(ProfilePatch, req.body);
    const [user] = await db.update(users).set(patch).where(eq(users.id, req.userId)).returning();
    if (!user) throw notFound('User not found');
    res.json(toPublic(user));
  }),
);

/** The signed-in user's own privacy settings (not exposed for other users). */
usersRouter.get(
  '/me/settings',
  h(async (req, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
    if (!user) throw notFound('User not found');
    res.json({
      shareActivity: user.shareActivity,
      discoverable: user.discoverable,
      role: user.role,
    });
  }),
);

usersRouter.get(
  '/me/stats',
  h(async (req, res) => {
    res.json(await getUserStats(req.userId));
  }),
);
