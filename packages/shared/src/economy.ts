/**
 * XP / level / coin economy. Pure functions shared by API (authoritative)
 * and clients (display, e.g. progress bars).
 */

export const XP_PER_KM = 20;
export const XP_PER_NEW_CELL = 10;
export const XP_PER_STOLEN_CELL = 15;
export const COINS_PER_CELL = 2;
export const STREAK_BONUS_PER_DAY = 0.05; // +5% XP per consecutive day, capped
export const STREAK_BONUS_CAP = 0.5;

export interface RunXpInput {
  distanceM: number;
  newCells: number;
  stolenCells: number;
  streakDays: number;
}

export function runXp(input: RunXpInput): number {
  const base =
    (input.distanceM / 1000) * XP_PER_KM +
    input.newCells * XP_PER_NEW_CELL +
    input.stolenCells * XP_PER_STOLEN_CELL;
  const bonus = Math.min(STREAK_BONUS_CAP, Math.max(0, input.streakDays - 1) * STREAK_BONUS_PER_DAY);
  return Math.round(base * (1 + bonus));
}

export function runCoins(input: { newCells: number; stolenCells: number }): number {
  return (input.newCells + input.stolenCells) * COINS_PER_CELL;
}

/** Total XP required to REACH a level (level 1 = 0 XP). Quadratic curve. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * (level - 1) ** 2 + 50 * (level - 1));
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  /** 0..1 progress toward next level */
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    currentLevelXp: cur,
    nextLevelXp: next,
    progress: next === cur ? 1 : (xp - cur) / (next - cur),
  };
}
