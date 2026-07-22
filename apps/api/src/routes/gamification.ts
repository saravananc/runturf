import type { Challenge, UnlockedAchievement } from '@runturf/shared';
import { asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/client.js';
import {
  achievements,
  challengeParticipants,
  challenges,
  userAchievements,
  users,
} from '../db/schema.js';
import { notFound } from '../errors.js';
import { h, idParam, requireAuth } from '../middleware.js';
import { toPublic } from '../services/auth.js';
import { listActiveChallenges } from '../services/challenges.js';

export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);

achievementsRouter.get(
  '/',
  h(async (_req, res) => {
    res.json(await db.query.achievements.findMany({ orderBy: [asc(achievements.sortOrder)] }));
  }),
);

export const myAchievementsRouter = Router();
myAchievementsRouter.use(requireAuth);

myAchievementsRouter.get(
  '/',
  h(async (req, res) => {
    const rows = await db
      .select({ a: achievements, unlockedAt: userAchievements.unlockedAt })
      .from(userAchievements)
      .innerJoin(achievements, eq(achievements.code, userAchievements.code))
      .where(eq(userAchievements.userId, req.userId))
      .orderBy(desc(userAchievements.unlockedAt));
    const out: UnlockedAchievement[] = rows.map(({ a, unlockedAt }) => ({
      code: a.code,
      title: a.title,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      unlockedAt: unlockedAt.toISOString(),
    }));
    res.json(out);
  }),
);

export const challengesRouter = Router();
challengesRouter.use(requireAuth);

challengesRouter.get(
  '/',
  h(async (req, res) => {
    // Generates the current week's challenges if the last set has rolled over.
    const active = await listActiveChallenges();
    const mine = await db.query.challengeParticipants.findMany({
      where: eq(challengeParticipants.userId, req.userId),
    });
    const mineById = new Map(mine.map((m) => [m.challengeId, m]));
    const out: Challenge[] = active.map((c) => {
      const p = mineById.get(c.id);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        metric: c.metric as Challenge['metric'],
        target: c.target,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        coinReward: c.coinReward,
        xpReward: c.xpReward,
        joined: !!p,
        progress: p?.progress ?? 0,
        completed: p?.completed ?? false,
      };
    });
    res.json(out);
  }),
);

challengesRouter.post(
  '/:id/join',
  h(async (req, res) => {
    const challenge = await db.query.challenges.findFirst({
      where: eq(challenges.id, idParam(req.params.id)),
    });
    if (!challenge) throw notFound('Challenge not found');
    await db
      .insert(challengeParticipants)
      .values({ challengeId: challenge.id, userId: req.userId })
      .onConflictDoNothing();
    res.status(201).json({ ok: true });
  }),
);

challengesRouter.get(
  '/:id/leaderboard',
  h(async (req, res) => {
    const rows = await db
      .select({ user: users, progress: challengeParticipants.progress, completed: challengeParticipants.completed })
      .from(challengeParticipants)
      .innerJoin(users, eq(users.id, challengeParticipants.userId))
      .where(eq(challengeParticipants.challengeId, idParam(req.params.id)))
      .orderBy(desc(challengeParticipants.progress))
      .limit(50);
    res.json(rows.map((r) => ({ user: toPublic(r.user), progress: r.progress, completed: r.completed })));
  }),
);
