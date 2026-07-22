import { weekBounds } from '@runturf/shared';
import { and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { challenges } from '../db/schema.js';

/**
 * The recurring weekly challenge set. One definition, used both by the seed and
 * by the runtime generator, so challenges can never drift between them.
 */
export const WEEKLY_TEMPLATES = [
  {
    slug: 'weekly_distance',
    title: 'Weekly 15K',
    description: 'Run a total of 15 km this week',
    metric: 'distance_m' as const,
    target: 15_000,
    coinReward: 50,
    xpReward: 200,
  },
  {
    slug: 'weekly_cells',
    title: 'Turf War',
    description: 'Capture 25 cells this week',
    metric: 'cells_captured' as const,
    target: 25,
    coinReward: 75,
    xpReward: 250,
  },
];

/**
 * Makes sure this week's challenges exist, generating them if the previously
 * seeded week has rolled over. Idempotent: the unique `code` (template + week
 * tag) means concurrent or repeated calls never create duplicates.
 *
 * Called lazily when challenges are read, so a fresh week self-heals without
 * needing a separate scheduler process.
 */
export async function ensureWeeklyChallenges(now: Date = new Date()): Promise<void> {
  const { start, end, tag } = weekBounds(now);
  await db
    .insert(challenges)
    .values(
      WEEKLY_TEMPLATES.map((t) => ({
        code: `${t.slug}_${tag}`,
        title: t.title,
        description: t.description,
        metric: t.metric,
        target: t.target,
        startsAt: start,
        endsAt: end,
        coinReward: t.coinReward,
        xpReward: t.xpReward,
      })),
    )
    .onConflictDoNothing({ target: challenges.code });
}

/** Challenges active at `now`, after ensuring the current week exists. */
export async function listActiveChallenges(now: Date = new Date()) {
  await ensureWeeklyChallenges(now);
  return db.query.challenges.findMany({
    where: and(lte(challenges.startsAt, now), gte(challenges.endsAt, now)),
    orderBy: (c, { asc }) => [asc(c.endsAt)],
  });
}
