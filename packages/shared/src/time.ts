/**
 * Week boundaries, shared by the API and clients.
 * ISO weeks start Monday. All computation is UTC — timezone support is deferred,
 * so streaks and weekly windows are UTC days everywhere.
 */

export interface WeekBounds {
  /** Monday 00:00:00 UTC of the week containing `now`. */
  start: Date;
  /** The following Monday 00:00:00 UTC (exclusive end). */
  end: Date;
  /** `YYYY-MM-DD` of the week start, used to tag per-week records. */
  tag: string;
}

/** Monday 00:00:00 UTC of the week containing `now`. */
export function isoWeekStart(now: Date = new Date()): Date {
  const start = new Date(now);
  const dayFromMonday = (start.getUTCDay() + 6) % 7; // Sunday(0) -> 6
  start.setUTCDate(start.getUTCDate() - dayFromMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function weekBounds(now: Date = new Date()): WeekBounds {
  const start = isoWeekStart(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end, tag: start.toISOString().slice(0, 10) };
}

/** `YYYY-MM-DD` for a date, in UTC. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
