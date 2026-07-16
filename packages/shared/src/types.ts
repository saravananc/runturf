/** API contract types shared by server and clients. */

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  color: string;
  createdAt: string;
}

export interface UserStats {
  xp: number;
  level: number;
  coins: number;
  streakDays: number;
  lastRunDate: string | null;
  totalRuns: number;
  totalDistanceM: number;
  cellsOwned: number;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
}

export interface RunPointInput {
  lat: number;
  lng: number;
  /** ms since epoch */
  t: number;
  acc?: number;
}

export interface RunSubmitInput {
  startedAt: string;
  points: RunPointInput[];
}

export interface RunSummary {
  id: string;
  startedAt: string;
  durationS: number;
  distanceM: number;
  avgPaceSPerKm: number | null;
  cellsCaptured: number;
  cellsStolen: number;
  xpGained: number;
}

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface UnlockedAchievement extends AchievementDef {
  unlockedAt: string;
}

export interface RunReport {
  run: RunSummary;
  xpGained: number;
  coinsGained: number;
  newAchievements: AchievementDef[];
  stats: UserStats;
  personalBests: string[];
}

export interface TerritoryCellFeatureProps {
  x: number;
  y: number;
  ownerId: string;
  ownerName: string;
  color: string;
  capturedAt: string;
}

export interface LeaderboardEntry {
  user: UserPublic;
  cellsOwned: number;
  weeklyDistanceM: number;
  xp: number;
  level: number;
}

export interface Challenge {
  id: string;
  code: string;
  title: string;
  description: string;
  metric: 'distance_m' | 'cells_captured';
  target: number;
  startsAt: string;
  endsAt: string;
  coinReward: number;
  xpReward: number;
  joined?: boolean;
  progress?: number;
  completed?: boolean;
}
