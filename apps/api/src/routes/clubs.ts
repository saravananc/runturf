import { Router } from 'express';
import { z } from 'zod';
import { h, idParam, parseBody, requireAuth } from '../middleware.js';
import {
  cancelClubEvent,
  createClub,
  createClubEvent,
  getClub,
  getMyClub,
  inviteToClub,
  joinClub,
  kickMember,
  leaveClub,
  listClubBattles,
  listClubEvents,
  listClubs,
  listMessages,
  listMyInvites,
  postMessage,
  proposeBattle,
  respondToBattle,
  respondToInvite,
  rsvpClubEvent,
  transferOwnership,
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

// Invite routes use fixed prefixes and MUST precede `/:id` so they are not
// swallowed by the UUID param route.
clubsRouter.get(
  '/invites',
  h(async (req, res) => {
    res.json(await listMyInvites(req.userId));
  }),
);

clubsRouter.post(
  '/invites/:id/accept',
  h(async (req, res) => {
    await respondToInvite(req.userId, idParam(req.params.id), true);
    res.json({ ok: true });
  }),
);

clubsRouter.post(
  '/invites/:id/decline',
  h(async (req, res) => {
    await respondToInvite(req.userId, idParam(req.params.id), false);
    res.json({ ok: true });
  }),
);

// Battle routes with fixed prefixes MUST precede `/:id` so the param route
// doesn't swallow them.
clubsRouter.post(
  '/battles',
  h(async (req, res) => {
    const { opponentClubId, durationHours } = parseBody(
      z.object({ opponentClubId: z.string().uuid(), durationHours: z.number().int().min(1).max(168) }),
      req.body,
    );
    res.status(201).json(await proposeBattle(req.userId, opponentClubId, durationHours));
  }),
);

clubsRouter.post(
  '/battles/:battleId/respond',
  h(async (req, res) => {
    const { accept } = parseBody(z.object({ accept: z.boolean() }), req.body);
    res.json(await respondToBattle(req.userId, idParam(req.params.battleId), accept));
  }),
);

clubsRouter.get(
  '/:id',
  h(async (req, res) => {
    res.json(await getClub(req.userId, idParam(req.params.id)));
  }),
);

clubsRouter.get(
  '/:id/battles',
  h(async (req, res) => {
    res.json(await listClubBattles(idParam(req.params.id)));
  }),
);

clubsRouter.get(
  '/:id/events',
  h(async (req, res) => {
    res.json(await listClubEvents(req.userId, idParam(req.params.id)));
  }),
);

clubsRouter.post(
  '/:id/events',
  h(async (req, res) => {
    const input = parseBody(
      z.object({
        title: z.string().min(3).max(80),
        description: z.string().max(500).optional(),
        location: z.string().max(120).optional(),
        startsAt: z.string().datetime(),
      }),
      req.body,
    );
    res.status(201).json(await createClubEvent(req.userId, idParam(req.params.id), input));
  }),
);

clubsRouter.post(
  '/events/:eventId/rsvp',
  h(async (req, res) => {
    const { going } = parseBody(z.object({ going: z.boolean() }), req.body);
    await rsvpClubEvent(req.userId, idParam(req.params.eventId), going);
    res.json({ ok: true });
  }),
);

clubsRouter.delete(
  '/events/:eventId',
  h(async (req, res) => {
    await cancelClubEvent(req.userId, idParam(req.params.eventId));
    res.status(204).end();
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

// Owner-only moderation.
clubsRouter.post(
  '/:id/invites',
  h(async (req, res) => {
    const { username } = parseBody(z.object({ username: z.string().min(3).max(24) }), req.body);
    await inviteToClub(req.userId, idParam(req.params.id), username);
    res.status(201).json({ ok: true });
  }),
);

clubsRouter.delete(
  '/:id/members/:userId',
  h(async (req, res) => {
    await kickMember(req.userId, idParam(req.params.id), idParam(req.params.userId));
    res.status(204).end();
  }),
);

clubsRouter.post(
  '/:id/transfer',
  h(async (req, res) => {
    const { userId } = parseBody(z.object({ userId: z.string().uuid() }), req.body);
    await transferOwnership(req.userId, idParam(req.params.id), userId);
    res.json({ ok: true });
  }),
);
