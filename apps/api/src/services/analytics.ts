import type { AnalyticsEvent, AnalyticsSource } from '@runturf/shared';
import { db } from '../db/client.js';
import { analyticsEvents } from '../db/schema.js';

/**
 * Persists a batch of client-reported events. `userId` comes from the verified
 * bearer token (or null for anonymous), never from the request body, so user
 * attribution stays trustworthy even though the events themselves are
 * client-supplied. Best-effort by design: analytics must never be the reason a
 * user action fails, so callers treat a rejection here as non-fatal.
 */
export async function recordEvents(
  userId: string | null,
  source: AnalyticsSource,
  events: AnalyticsEvent[],
): Promise<number> {
  if (events.length === 0) return 0;
  const rows = events.map((e) => ({
    userId,
    source,
    name: e.name,
    props: e.props ?? null,
    clientTs: e.ts ? new Date(e.ts) : null,
  }));
  await db.insert(analyticsEvents).values(rows);
  return rows.length;
}
