import { Router } from 'express';
import { z } from 'zod';
import { h, idParam, parseBody, requireAuth } from '../middleware.js';
import {
  createClub,
  getClub,
  getMyClub,
  joinClub,
  leaveClub,
  listClubs,
  listMessages,
  postMessage,
} from '../services/clubs.js';

export const clubsRouter = Router();
clubsRouter.use(requireAuth);

clubsRouter.get(
  '/',
  h(async (req, res) => {
    const { q } = parseBody(z.object({ q: z.string().max(48).optional() }), req.query);
    res.json(await listClubs(q));
  }),
);

clubsRouter.post(
  '/',
  h(async (req, res) => {
    const input = parseBody(
      z.object({
        name: z.string().min(3).max(32),
        tag: z.string().min(2).max(5),
        description: z.string().max(200).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
      req.body,
    );
    res.status(201).json(await createClub(req.userId, input));
  }),
);

clubsRouter.get(
  '/mine',
  h(async (req, res) => {
    res.json(await getMyClub(req.userId));
  }),
);

clubsRouter.get(
  '/:id',
  h(async (req, res) => {
    res.json(await getClub(req.userId, idParam(req.params.id)));
  }),
);

clubsRouter.post(
  '/:id/join',
  h(async (req, res) => {
    await joinClub(req.userId, idParam(req.params.id));
    res.status(201).json({ ok: true });
  }),
);

clubsRouter.post(
  '/leave',
  h(async (req, res) => {
    await leaveClub(req.userId);
    res.json({ ok: true });
  }),
);

clubsRouter.get(
  '/:id/messages',
  h(async (req, res) => {
    res.json(await listMessages(req.userId, idParam(req.params.id)));
  }),
);

clubsRouter.post(
  '/:id/messages',
  h(async (req, res) => {
    const { body } = parseBody(z.object({ body: z.string().min(1).max(500) }), req.body);
    res.status(201).json(await postMessage(req.userId, idParam(req.params.id), body));
  }),
);
