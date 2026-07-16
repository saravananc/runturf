import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { notFound } from '../errors.js';
import { h, parseBody, requireAuth } from '../middleware.js';
import { login, refresh, register, toPublic } from '../services/auth.js';

const Credentials = z.object({
  username: z.string().min(3).max(24),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(48).optional(),
});

export const authRouter = Router();

authRouter.post(
  '/register',
  h(async (req, res) => {
    res.status(201).json(await register(parseBody(Credentials, req.body)));
  }),
);

authRouter.post(
  '/login',
  h(async (req, res) => {
    res.json(await login(parseBody(Credentials.omit({ displayName: true }), req.body)));
  }),
);

authRouter.post(
  '/refresh',
  h(async (req, res) => {
    const { refreshToken } = parseBody(z.object({ refreshToken: z.string().min(1) }), req.body);
    res.json(await refresh(refreshToken));
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  h(async (req, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
    if (!user) throw notFound('User not found');
    res.json(toPublic(user));
  }),
);
