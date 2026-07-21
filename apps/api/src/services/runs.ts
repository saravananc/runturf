import {
  pathDistanceM,
  type RunPointInput,
  type RunReport,
  type RunSummary,
} from '@runturf/shared';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { runs } from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { applyRunRewards } from './gamification.js';
import { getUserStats } from './stats.js';
import { captureCells } from './territory.js';

const MAX_POINTS = 100_000;
const MAX_PLAUSIBLE_AVG_SPEED_MS = 8; // ~2:05 min/km — faster than any human run
const MIN_POINTS = 2;

export function summarizeRun(startedAt: Date, points: RunPointInput[], pausedMs = 0) {
  if (points.length < MIN_POINTS) throw badRequest('A run needs at least 2 GPS points');
  if (points.length > MAX_POINTS) throw badRequest('Too many points');
  for (let i = 1; i < points.length; i++) {
    if (points[i].t < points[i - 1].t) throw badRequest('GPS timestamps must be non-decreasing');
  }
  const spanMs = points[points.length - 1].t - points[0].t;
  if (pausedMs < 0 || pausedMs > spanMs) throw badRequest('Invalid paused duration');
  // Moving time: paused stretches must not inflate duration or deflate pace.
  const durationS = Math.round((spanMs - pausedMs) / 1000);
  if (durationS <= 0) throw badRequest('Run duration must be positive');

  const distanceM = pathDistanceM(points);
  if (distanceM / durationS > MAX_PLAUSIBLE_AVG_SPEED_MS) {
    throw badRequest('Run rejected: average speed is not plausible for running');
  }
  const avgPaceSPerKm = distanceM >= 100 ? Math.round(durationS / (distanceM / 1000)) : null;
  return { startedAt, durationS, distanceM, avgPaceSPerKm };
}

export function toRunSummary(r: typeof runs.$inferSelect): RunSummary {
  return {
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    durationS: r.durationS,
    distanceM: r.distanceM,
    avgPaceSPerKm: r.avgPaceSPerKm,
    cellsCaptured: r.cellsCaptured,
    cellsStolen: r.cellsStolen,
    xpGained: r.xpGained,
  };
}

export async function submitRun(
  userId: string,
  input: { startedAt: string; points: RunPointInput[]; pausedMs?: number },
): Promise<RunReport> {
  const startedAt = new Date(input.startedAt);
  if (Number.isNaN(startedAt.getTime())) throw badRequest('Invalid startedAt');
  const summary = summarizeRun(startedAt, input.points, input.pausedMs ?? 0);

  const personalBests = await detectPersonalBests(userId, summary);

  const { run, rewards } = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(runs)
      .values({
        userId,
        startedAt,
        durationS: summary.durationS,
        distanceM: summary.distanceM,
        avgPaceSPerKm: summary.avgPaceSPerKm,
        rawPoints: input.points,
      })
      .returning();

    const capture = await captureCells(tx, userId, inserted.id, input.points);
    const rewards = await applyRunRewards(
      tx,
      userId,
      { distanceM: summary.distanceM, durationS: summary.durationS, startedAt },
      capture,
    );

    const [run] = await tx
      .update(runs)
      .set({
        cellsCaptured: capture.newCells,
        cellsStolen: capture.stolenCells,
        xpGained: rewards.xpGained,
      })
      .where(eq(runs.id, inserted.id))
      .returning();
    return { run, rewards };
  });

  return {
    run: toRunSummary(run),
    xpGained: rewards.xpGained,
    coinsGained: rewards.coinsGained,
    newAchievements: rewards.newAchievements,
    stats: await getUserStats(userId),
    personalBests,
  };
}

async function detectPersonalBests(
  userId: string,
  summary: { distanceM: number; durationS: number; avgPaceSPerKm: number | null },
): Promise<string[]> {
  const prev = await db.query.runs.findMany({
    where: eq(runs.userId, userId),
    columns: { distanceM: true, durationS: true, avgPaceSPerKm: true },
  });
  if (prev.length === 0) return [];
  const bests: string[] = [];
  if (summary.distanceM > Math.max(...prev.map((r) => r.distanceM))) {
    bests.push('Longest run');
  }
  const prevPaces = prev
    .filter((r) => r.avgPaceSPerKm !== null && r.distanceM >= 1000)
    .map((r) => r.avgPaceSPerKm!);
  if (
    summary.avgPaceSPerKm !== null &&
    summary.distanceM >= 1000 &&
    prevPaces.length > 0 &&
    summary.avgPaceSPerKm < Math.min(...prevPaces)
  ) {
    bests.push('Best pace');
  }
  return bests;
}

export async function listRuns(userId: string, limit = 50): Promise<RunSummary[]> {
  const rows = await db.query.runs.findMany({
    where: eq(runs.userId, userId),
    orderBy: [desc(runs.startedAt)],
    limit,
  });
  return rows.map(toRunSummary);
}

export async function getRun(userId: string, runId: string) {
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run || run.userId !== userId) throw notFound('Run not found');
  return { ...toRunSummary(run), points: run.rawPoints as RunPointInput[] };
}

export async function deleteRun(userId: string, runId: string) {
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run || run.userId !== userId) throw notFound('Run not found');
  await db.delete(runs).where(eq(runs.id, runId));
}
