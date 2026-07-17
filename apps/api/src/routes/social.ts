import { Router } from 'express';
import { z } from 'zod';
import { h, idParam, parseBody, requireAuth } from '../middleware.js';
import {
  getFeed,
  listFriends,
  listRequests,
  removeFriend,
  respondToRequest,
  searchUsers,
  sendFriendRequest,
} from '../services/social.js';

export const socialRouter = Router();
socialRouter.use(requireAuth);

socialRouter.get(
  '/search',
  h(async (req, res) => {
    const { q } = parseBody(z.object({ q: z.string().max(48) }), req.query);
    res.json(await searchUsers(req.userId, q));
  }),
);

socialRouter.get(
  '/feed',
  h(async (req, res) => {
    res.json(await getFeed(req.userId));
  }),
);

socialRouter.get(
  '/friends',
  h(async (req, res) => {
    res.json(await listFriends(req.userId));
  }),
);

socialRouter.delete(
  '/friends/:userId',
  h(async (req, res) => {
    await removeFriend(req.userId, idParam(req.params.userId));
    res.status(204).end();
  }),
);

socialRouter.get(
  '/requests',
  h(async (req, res) => {
    res.json(await listRequests(req.userId));
  }),
);

socialRouter.post(
  '/requests',
  h(async (req, res) => {
    const { username } = parseBody(z.object({ username: z.string().min(3).max(24) }), req.body);
    await sendFriendRequest(req.userId, username);
    res.status(201).json({ ok: true });
  }),
);

socialRouter.post(
  '/requests/:id/accept',
  h(async (req, res) => {
    await respondToRequest(req.userId, idParam(req.params.id), true);
    res.json({ ok: true });
  }),
);

socialRouter.post(
  '/requests/:id/decline',
  h(async (req, res) => {
    await respondToRequest(req.userId, idParam(req.params.id), false);
    res.json({ ok: true });
  }),
);
