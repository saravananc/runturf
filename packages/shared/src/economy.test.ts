import { describe, expect, it } from 'vitest';
import {
  levelForXp,
  levelProgress,
  runCoins,
  runXp,
  xpForLevel,
} from './economy.js';

describe('runXp', () => {
  it('awards distance + cell XP with no streak bonus on day 1', () => {
    // 5 km = 100 XP, 10 new cells = 100 XP, 2 stolen = 30 XP
    expect(runXp({ distanceM: 5000, newCells: 10, stolenCells: 2, streakDays: 1 })).toBe(230);
  });

  it('applies streak bonus, capped at 50%', () => {
    const base = runXp({ distanceM: 5000, newCells: 0, stolenCells: 0, streakDays: 1 });
    const boosted = runXp({ distanceM: 5000, newCells: 0, stolenCells: 0, streakDays: 3 });
    expect(boosted).toBe(Math.round(base * 1.1));
    const capped = runXp({ distanceM: 5000, newCells: 0, stolenCells: 0, streakDays: 100 });
    expect(capped).toBe(Math.round(base * 1.5));
  });
});

describe('runCoins', () => {
  it('pays per captured cell', () => {
    expect(runCoins({ newCells: 3, stolenCells: 2 })).toBe(10);
  });
});

describe('levels', () => {
  it('level 1 starts at 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });

  it('is monotonically increasing', () => {
    for (let l = 1; l < 20; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    }
  });

  it('levelForXp inverts xpForLevel at boundaries', () => {
    for (let l = 2; l < 15; l++) {
      const xp = xpForLevel(l);
      expect(levelForXp(xp)).toBe(l);
      expect(levelForXp(xp - 1)).toBe(l - 1);
    }
  });

  it('levelProgress reports 0..1 progress', () => {
    const p = levelProgress(xpForLevel(3) + 1);
    expect(p.level).toBe(3);
    expect(p.progress).toBeGreaterThan(0);
    expect(p.progress).toBeLessThan(1);
  });
});
