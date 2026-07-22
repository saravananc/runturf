import { describe, expect, it } from 'vitest';
import { dayKey, isoWeekStart, weekBounds } from './time.js';

describe('isoWeekStart', () => {
  it('returns the Monday of the containing week', () => {
    // 2026-07-22 is a Wednesday; its ISO week starts Monday 2026-07-20.
    expect(dayKey(isoWeekStart(new Date('2026-07-22T13:45:00Z')))).toBe('2026-07-20');
  });

  it('treats Monday itself as the week start', () => {
    expect(dayKey(isoWeekStart(new Date('2026-07-20T00:00:00Z')))).toBe('2026-07-20');
  });

  it('puts Sunday in the week that began the previous Monday', () => {
    // Sunday 2026-07-26 belongs to the week starting 2026-07-20 (not 07-27).
    expect(dayKey(isoWeekStart(new Date('2026-07-26T23:59:59Z')))).toBe('2026-07-20');
  });

  it('is midnight UTC', () => {
    const s = isoWeekStart(new Date('2026-07-22T13:45:00Z'));
    expect([s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds(), s.getUTCMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('is idempotent', () => {
    const once = isoWeekStart(new Date('2026-07-22T13:45:00Z'));
    expect(isoWeekStart(once).getTime()).toBe(once.getTime());
  });
});

describe('weekBounds', () => {
  it('spans exactly seven days, end exclusive', () => {
    const { start, end } = weekBounds(new Date('2026-07-22T13:45:00Z'));
    expect(end.getTime() - start.getTime()).toBe(7 * 86_400_000);
  });

  it('contains the given moment', () => {
    const now = new Date('2026-07-22T13:45:00Z');
    const { start, end } = weekBounds(now);
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(now.getTime()).toBeLessThan(end.getTime());
  });

  it('tags the week by its start date', () => {
    expect(weekBounds(new Date('2026-07-22T13:45:00Z')).tag).toBe('2026-07-20');
  });

  it('consecutive weeks abut without gap or overlap', () => {
    const a = weekBounds(new Date('2026-07-22T00:00:00Z'));
    const b = weekBounds(new Date('2026-07-29T00:00:00Z'));
    expect(b.start.getTime()).toBe(a.end.getTime());
  });
});
