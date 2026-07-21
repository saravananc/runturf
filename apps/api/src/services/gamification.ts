import {
  levelForXp,
  runCoins,
  runXp,
  type AchievementDef,
} from '@runturf/shared';
import { and, count, eq, gte, lte } from 'drizzle-orm';
import { type Db } from '../db/client.js';
import {
  achievements,
  challengeParticipants,
  challenges,
  territoryCells,
  userAchievements,
  userStats,
} from '../db/schema.js';
import type { CaptureResult } from './territory.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface RewardResult {
  xpGained: number;
  coinsGained: number;
  newAchievements: AchievementDef[];
  streakDays: number;
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10); // UTC day for MVP

/**
 * Streak for a run on `runDay`, given the last recorded run day.
 * Runs submitted out of order (backdated) must never rewind an existing streak,
 * so an older run leaves both the streak and lastRunDate untouched.
 */
function computeStreak(
  lastRunDate: string | null,
  runDay: string,
  currentStreak: number,
): { streakDays: number; lastRunDate: string } {
  if (!lastRunDate) return { streakDays: 1, lastRunDate: runDay };
  if (runDay === lastRunDate) {
    // Another run the same day: streak unchanged (but never below 1).
    return { streakDays: Math.max(currentStreak, 1), lastRunDate };
  }
  if (runDay < lastRunDate) {
    // Backdated run: keep the more recent state intact.
    return { streakDays: Math.max(currentStreak, 1), lastRunDate };
  }
  const dayAfterLast = new Date(`${lastRunDate}T00:00:00Z`);
  dayAfterLast.setUTCDate(dayAfterLast.getUTCDate() + 1);
  const consecutive = dateKey(dayAfterLast) === runDay;
  return { streakDays: consecutive ? currentStreak + 1 : 1, lastRunDate: runDay };
}

/**
 * Applies all run rewards inside the submit transaction: streak, XP, coins,
 * level, achievements, and challenge progress. Returns what was gained.
 */
export async function applyRunRewards(
  tx: Tx,
  userId: string,
  run: { distanceM: number; durationS: number; startedAt: Date },
  capture: CaptureResult,
): Promise<RewardResult> {
  const stats = await tx.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  if (!stats) throw new Error('user_stats row missing');

  // Streak (computed against UTC days; timezone support deferred)
  const runDay = dateKey(run.startedAt);
  const { streakDays, lastRunDate } = computeStreak(
    stats.lastRunDate,
    runDay,
    stats.streakDays,
  );

  let xpGained = runXp({
    distanceM: run.distanceM,
    newCells: capture.newCells,
    stolenCells: capture.stolenCells,
    streakDays,
  });
  let coinsGained = runCoins(capture);

  // Base stats update (before achievements so predicates see fresh totals)
  const totalRuns = stats.totalRuns + 1;
  const totalDistanceM = stats.totalDistanceM + run.distanceM;

  const [{ cellsOwned }] = await tx
    .select({ cellsOwned: count() })
    .from(territoryCells)
    .where(eq(territoryCells.ownerId, userId));

  // Achievements
  const unlockedRows = await tx.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
    columns: { code: true },
  });
  const unlocked = new Set(unlockedRows.map((r) => r.code));
  const ctx = {
    runDistanceM: run.distanceM,
    totalRuns,
    totalDistanceM,
    cellsOwned: Number(cellsOwned),
    newCells: capture.newCells,
    stolenCells: capture.stolenCells,
    streakDays,
  };
  const earnedCodes = ACHIEVEMENT_RULES.filter(
    (r) => !unlocked.has(r.code) && r.test(ctx),
  ).map((r) => r.code);

  let newAchievements: AchievementDef[] = [];
  if (earnedCodes.length > 0) {
    const defs = await tx.query.achievements.findMany({
      where: (a, { inArray }) => inArray(a.code, earnedCodes),
    });
    newAchievements = defs
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => ({
        code: d.code,
        title: d.title,
        description: d.description,
        icon: d.icon,
        xpReward: d.xpReward,
      }));
    await tx
      .insert(userAchievements)
      .values(earnedCodes.map((code) => ({ userId, code })))
      .onConflictDoNothing();
    xpGained += newAchievements.reduce((s, a) => s + a.xpReward, 0);
  }

  // Challenges the user joined and that are active for this run
  const joined = await tx
    .select({ cp: challengeParticipants, ch: challenges })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
    .where(
      and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.completed, false),
        lte(challenges.startsAt, run.startedAt),
        gte(challenges.endsAt, run.startedAt),
      ),
    );
  for (const { cp, ch } of joined) {
    const delta =
      ch.metric === 'distance_m' ? run.distanceM : capture.newCells + capture.stolenCells;
    const progress = cp.progress + delta;
    const completed = progress >= ch.target;
    await tx
      .update(challengeParticipants)
      .set({ progress, completed })
      .where(
        and(
          eq(challengeParticipants.challengeId, cp.challengeId),
          eq(challengeParticipants.userId, userId),
        ),
      );
    if (completed) {
      xpGained += ch.xpReward;
      coinsGained += ch.coinReward;
    }
  }

  // "level_5" achievement can only be evaluated after XP is final; handle inline
  const xp = stats.xp + xpGained;
  let level = levelForXp(xp);
  if (level >= 5 && !unlocked.has('level_5') && !earnedCodes.includes('level_5')) {
    const def = await tx.query.achievements.findFirst({
      where: eq(achievements.code, 'level_5'),
    });
    if (def) {
      await tx.insert(userAchievements).values({ userId, code: 'level_5' }).onConflictDoNothing();
      newAchievements.push({
        code: def.code,
        title: def.title,
        description: def.description,
        icon: def.icon,
        xpReward: def.xpReward,
      });
      level = levelForXp(xp);
    }
  }

  await tx
    .update(userStats)
    .set({
      xp,
      level,
      coins: stats.coins + coinsGained,
      streakDays,
      lastRunDate,
      totalRuns,
      totalDistanceM,
    })
    .where(eq(userStats.userId, userId));

  return { xpGained, coinsGained, newAchievements, streakDays };
}

interface AchievementCtx {
  runDistanceM: number;
  totalRuns: number;
  totalDistanceM: number;
  cellsOwned: number;
  newCells: number;
  stolenCells: number;
  streakDays: number;
}

const ACHIEVEMENT_RULES: { code: string; test: (c: AchievementCtx) => boolean }[] = [
  { code: 'first_run', test: (c) => c.totalRuns >= 1 },
  { code: 'run_5k', test: (c) => c.runDistanceM >= 5000 },
  { code: 'run_10k', test: (c) => c.runDistanceM >= 10_000 },
  { code: 'total_50k', test: (c) => c.totalDistanceM >= 50_000 },
  { code: 'first_capture', test: (c) => c.newCells + c.stolenCells >= 1 },
  { code: 'cells_10', test: (c) => c.cellsOwned >= 10 },
  { code: 'cells_50', test: (c) => c.cellsOwned >= 50 },
  { code: 'first_steal', test: (c) => c.stolenCells >= 1 },
  { code: 'streak_3', test: (c) => c.streakDays >= 3 },
  { code: 'streak_7', test: (c) => c.streakDays >= 7 },
  { code: 'runs_10', test: (c) => c.totalRuns >= 10 },
];
