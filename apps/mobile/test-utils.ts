/**
 * Fixtures shared by the screen tests.
 *
 * Data only, deliberately: jest.mock factories are hoisted above imports and
 * may not close over module scope, so each suite declares its own mock factory
 * and pulls fixtures in with require() from inside it.
 */
import type { UserPublic, UserStats } from '@runturf/shared';

export const alice: UserPublic = {
  id: 'u1',
  username: 'demo',
  displayName: 'Demo Runner',
  color: '#3b82f6',
  createdAt: '2026-07-01T00:00:00.000Z',
};

export const bob: UserPublic = {
  id: 'u2',
  username: 'rival',
  displayName: 'Rival Runner',
  color: '#ef4444',
  createdAt: '2026-07-01T00:00:00.000Z',
};

export const stats: UserStats = {
  xp: 839,
  level: 4,
  coins: 14,
  streakDays: 1,
  lastRunDate: '2026-07-23',
  totalRuns: 7,
  totalDistanceM: 4641,
  cellsOwned: 25,
};
