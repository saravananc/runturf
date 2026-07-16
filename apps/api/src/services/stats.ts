import type { UserStats } from '@runturf/shared';
import { count, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { territoryCells, userStats } from '../db/schema.js';
import { notFound } from '../errors.js';

export async function getUserStats(userId: string): Promise<UserStats> {
  const stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  if (!stats) throw notFound('Stats not found');
  const [{ owned }] = await db
    .select({ owned: count() })
    .from(territoryCells)
    .where(eq(territoryCells.ownerId, userId));
  return {
    xp: stats.xp,
    level: stats.level,
    coins: stats.coins,
    streakDays: stats.streakDays,
    lastRunDate: stats.lastRunDate,
    totalRuns: stats.totalRuns,
    totalDistanceM: stats.totalDistanceM,
    cellsOwned: owned,
  };
}
