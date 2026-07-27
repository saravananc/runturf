import {
  cellsInBBox,
  cellsOnPath,
  cellToPolygon,
  isoWeekStart,
  TERRITORY_DECAY_DAYS,
  TERRITORY_ZOOM,
  type BBox,
  type LatLng,
  type LeaderboardEntry,
} from '@runturf/shared';
import { and, count, desc, eq, gte, lt, lte, sql, sum } from 'drizzle-orm';
import { config } from '../config.js';
import { db, type Db } from '../db/client.js';
import { cellCaptures, runs, territoryCells, users, userStats } from '../db/schema.js';
import { badRequest } from '../errors.js';
import { toPublic } from './auth.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const DAY_MS = 86_400_000;

/** Cells captured before this instant have decayed back to neutral. */
export function decayCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TERRITORY_DECAY_DAYS * DAY_MS);
}

/**
 * Deletes decayed cells so they revert to neutral. Counts computed live from
 * `territory_cells` (leaderboard, profile, clubs, achievements) then reflect the
 * decay for free. Runs inside the run-submit transaction (so captures start from
 * a clean board) and, throttled, on territory reads. Returns the number removed.
 */
export async function decayTerritory(
  exec: Pick<Db, 'delete'> | Tx = db,
  before: Date = decayCutoff(),
): Promise<number> {
  const deleted = await exec
    .delete(territoryCells)
    .where(lt(territoryCells.capturedAt, before))
    .returning({ x: territoryCells.x });
  return deleted.length;
}

// Reads run the sweep at most this often, so panning the map doesn't delete on
// every request while quiet periods still eventually reclaim decayed turf.
const SWEEP_THROTTLE_MS = 60_000;
let lastSweep = 0;
async function maybeSweep(): Promise<void> {
  // Tests drive decay explicitly via decayTerritory(); a background sweep here
  // would race with their assertions against the shared DB.
  if (config.NODE_ENV === 'test') return;
  const now = Date.now();
  if (now - lastSweep < SWEEP_THROTTLE_MS) return;
  lastSweep = now;
  await decayTerritory();
}

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

  // Fetch current owners of exactly the touched cells. Matching the (x, y)
  // pairs as a tuple avoids the cartesian product that `x IN (…) AND y IN (…)`
  // would read (every crossing of the route's columns and rows). Cell count is
  // bounded by run length — a marathon at zoom 18 touches a few hundred cells.
  const pairs = sql.join(
    cells.map((c) => sql`(${c.x}, ${c.y})`),
    sql`, `,
  );
  const existing = await tx
    .select({ x: territoryCells.x, y: territoryCells.y, ownerId: territoryCells.ownerId })
    .from(territoryCells)
    .where(
      and(
        eq(territoryCells.zoom, TERRITORY_ZOOM),
        sql`(${territoryCells.x}, ${territoryCells.y}) IN (${pairs})`,
      ),
    );
  const ownerByKey = new Map(existing.map((c) => [`${c.x}:${c.y}`, c.ownerId]));

  const now = new Date();
  const result: CaptureResult = { newCells: 0, stolenCells: 0, retainedCells: 0 };
  const captures: (typeof cellCaptures.$inferInsert)[] = [];

  for (const cell of cells) {
    const prevOwner = ownerByKey.get(`${cell.x}:${cell.y}`);
    if (prevOwner === userId) {
      result.retainedCells++;
      continue; // ownership unchanged; the upsert below refreshes its freshness
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

  // Upsert *every* touched cell (cellsOnPath dedupes, so no key repeats). This
  // claims new/stolen cells and — the point of decay — refreshes capturedAt on
  // cells the runner already owned, so turf they keep running through never fades.
  await tx
    .insert(territoryCells)
    .values(
      cells.map((c) => ({
        zoom: TERRITORY_ZOOM,
        x: c.x,
        y: c.y,
        ownerId: userId,
        capturedAt: now,
        runId,
      })),
    )
    .onConflictDoUpdate({
      target: [territoryCells.zoom, territoryCells.x, territoryCells.y],
      set: { ownerId: userId, capturedAt: now, runId },
    });

  // History records ownership changes only, not freshness refreshes.
  if (captures.length > 0) await tx.insert(cellCaptures).values(captures);
  return result;
}

const MAX_VIEWPORT_CELLS = 15_000;

/** Territory cells in a viewport as a GeoJSON FeatureCollection. */
export async function territoryInBBox(bbox: BBox): Promise<GeoJSONFC> {
  // Validate every edge, not just north/west: the route's zod schema also
  // checks these, but this service must be safe when called directly.
  if (
    !(bbox.west < bbox.east) ||
    !(bbox.south < bbox.north) ||
    !Number.isFinite(bbox.north) ||
    !Number.isFinite(bbox.south) ||
    !Number.isFinite(bbox.east) ||
    !Number.isFinite(bbox.west) ||
    Math.abs(bbox.north) > 90 ||
    Math.abs(bbox.south) > 90 ||
    Math.abs(bbox.east) > 180 ||
    Math.abs(bbox.west) > 180
  ) {
    throw badRequest('Invalid bbox');
  }
  await maybeSweep(); // reclaim decayed turf so the map reflects it
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

  const now = Date.now();
  const decayMs = TERRITORY_DECAY_DAYS * DAY_MS;
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
        // 1 = just captured, → 0 as the cell approaches the decay cutoff. Lets
        // clients fade aging turf without re-deriving the decay window.
        freshness: Math.max(0, Math.min(1, 1 - (now - r.capturedAt.getTime()) / decayMs)),
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

export async function territoryLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  await maybeSweep(); // so cell counts don't include decayed turf
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
