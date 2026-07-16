import {
  cellsInBBox,
  cellsOnPath,
  cellToPolygon,
  TERRITORY_ZOOM,
  type BBox,
  type LatLng,
  type LeaderboardEntry,
} from '@runturf/shared';
import { and, count, desc, eq, gte, inArray, lte, sql, sum } from 'drizzle-orm';
import { db, type Db } from '../db/client.js';
import { cellCaptures, runs, territoryCells, users, userStats } from '../db/schema.js';
import { badRequest } from '../errors.js';
import { toPublic } from './auth.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface CaptureResult {
  newCells: number;
  stolenCells: number;
  /** cells already owned by this runner that the route re-visited */
  retainedCells: number;
}

/**
 * Claims every cell the route passes through for `userId`.
 * Cells with no owner count as new; cells owned by someone else are stolen.
 */
export async function captureCells(
  tx: Tx,
  userId: string,
  runId: string,
  path: LatLng[],
): Promise<CaptureResult> {
  const cells = cellsOnPath(path, TERRITORY_ZOOM);
  if (cells.length === 0) return { newCells: 0, stolenCells: 0, retainedCells: 0 };

  // Fetch current owners of the touched cells. Cell count is bounded by run
  // length (a marathon at zoom 18 touches only a few hundred cells).
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const existing = await tx
    .select({ x: territoryCells.x, y: territoryCells.y, ownerId: territoryCells.ownerId })
    .from(territoryCells)
    .where(
      and(
        eq(territoryCells.zoom, TERRITORY_ZOOM),
        inArray(territoryCells.x, xs),
        inArray(territoryCells.y, ys),
      ),
    );
  const ownerByKey = new Map(existing.map((c) => [`${c.x}:${c.y}`, c.ownerId]));

  const result: CaptureResult = { newCells: 0, stolenCells: 0, retainedCells: 0 };
  const captures: (typeof cellCaptures.$inferInsert)[] = [];

  for (const cell of cells) {
    const prevOwner = ownerByKey.get(`${cell.x}:${cell.y}`);
    if (prevOwner === userId) {
      result.retainedCells++;
      continue;
    }
    if (prevOwner === undefined) result.newCells++;
    else result.stolenCells++;
    captures.push({
      zoom: TERRITORY_ZOOM,
      x: cell.x,
      y: cell.y,
      newOwnerId: userId,
      prevOwnerId: prevOwner ?? null,
      runId,
    });
  }

  if (captures.length > 0) {
    await tx
      .insert(territoryCells)
      .values(
        captures.map((c) => ({
          zoom: c.zoom,
          x: c.x,
          y: c.y,
          ownerId: userId,
          capturedAt: new Date(),
          runId,
        })),
      )
      .onConflictDoUpdate({
        target: [territoryCells.zoom, territoryCells.x, territoryCells.y],
        set: { ownerId: userId, capturedAt: new Date(), runId },
      });
    await tx.insert(cellCaptures).values(captures);
  }
  return result;
}

const MAX_VIEWPORT_CELLS = 15_000;

/** Territory cells in a viewport as a GeoJSON FeatureCollection. */
export async function territoryInBBox(bbox: BBox): Promise<GeoJSONFC> {
  if (
    !(bbox.west < bbox.east) ||
    !(bbox.south < bbox.north) ||
    Math.abs(bbox.north) > 90 ||
    Math.abs(bbox.west) > 180
  ) {
    throw badRequest('Invalid bbox');
  }
  const probe = cellsInBBox(bbox, TERRITORY_ZOOM, MAX_VIEWPORT_CELLS + 1);
  if (probe.length > MAX_VIEWPORT_CELLS) {
    // Viewport zoomed out too far to render individual cells.
    return { type: 'FeatureCollection', features: [] };
  }
  const minX = Math.min(...probe.map((c) => c.x));
  const maxX = Math.max(...probe.map((c) => c.x));
  const minY = Math.min(...probe.map((c) => c.y));
  const maxY = Math.max(...probe.map((c) => c.y));

  const rows = await db
    .select({
      x: territoryCells.x,
      y: territoryCells.y,
      capturedAt: territoryCells.capturedAt,
      ownerId: users.id,
      ownerName: users.displayName,
      color: users.color,
    })
    .from(territoryCells)
    .innerJoin(users, eq(users.id, territoryCells.ownerId))
    .where(
      and(
        eq(territoryCells.zoom, TERRITORY_ZOOM),
        gte(territoryCells.x, minX),
        lte(territoryCells.x, maxX),
        gte(territoryCells.y, minY),
        lte(territoryCells.y, maxY),
      ),
    );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature' as const,
      properties: {
        x: r.x,
        y: r.y,
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        color: r.color,
        capturedAt: r.capturedAt.toISOString(),
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [cellToPolygon({ x: r.x, y: r.y }, TERRITORY_ZOOM)],
      },
    })),
  };
}

interface GeoJSONFC {
  type: 'FeatureCollection';
  features: unknown[];
}

function isoWeekStart(now = new Date()): Date {
  const start = new Date(now);
  const day = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function territoryLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const owned = db
    .select({ ownerId: territoryCells.ownerId, cellsOwned: count().as('cells_owned') })
    .from(territoryCells)
    .groupBy(territoryCells.ownerId)
    .as('owned');

  const weekly = db
    .select({
      userId: runs.userId,
      weeklyDistanceM: sum(runs.distanceM).as('weekly_distance_m'),
    })
    .from(runs)
    .where(gte(runs.startedAt, isoWeekStart()))
    .groupBy(runs.userId)
    .as('weekly');

  const rows = await db
    .select({
      user: users,
      xp: userStats.xp,
      level: userStats.level,
      cellsOwned: sql<number>`COALESCE(${owned.cellsOwned}, 0)`,
      weeklyDistanceM: sql<number>`COALESCE(${weekly.weeklyDistanceM}, 0)`,
    })
    .from(users)
    .innerJoin(userStats, eq(userStats.userId, users.id))
    .leftJoin(owned, eq(owned.ownerId, users.id))
    .leftJoin(weekly, eq(weekly.userId, users.id))
    .orderBy(desc(sql`COALESCE(${owned.cellsOwned}, 0)`), desc(userStats.xp))
    .limit(limit);

  return rows.map((r) => ({
    user: toPublic(r.user),
    cellsOwned: Number(r.cellsOwned),
    weeklyDistanceM: Number(r.weeklyDistanceM),
    xp: r.xp,
    level: r.level,
  }));
}
