/** API contract types shared by server and clients. */

/**
 * Territory/avatar colours a runner can be assigned or choose.
 * Shared so the server's random pick and the client's picker stay in sync.
 */
export const USER_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#06b6d4',
] as const;

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
  /** Milliseconds spent paused, excluded from duration and pace. */
  pausedMs?: number;
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

export interface FriendEntry {
  user: UserPublic;
  since: string;
  level: number;
  cellsOwned: number;
  totalDistanceM: number;
}

export interface FriendRequest {
  id: string;
  user: UserPublic;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

export interface FeedItem {
  id: string;
  user: UserPublic;
  startedAt: string;
  distanceM: number;
  durationS: number;
  avgPaceSPerKm: number | null;
  cellsCaptured: number;
  cellsStolen: number;
  xpGained: number;
}

export interface ClubSummary {
  id: string;
  name: string;
  tag: string;
  description: string;
  color: string;
  memberCount: number;
  cellsOwned: number;
  weeklyCellsCaptured: number;
}

export interface ClubDetail extends ClubSummary {
  ownerId: string;
  members: (UserPublic & { role: string; level: number; cellsOwned: number })[];
  myRole: 'owner' | 'member' | null;
}

export interface ClubMessage {
  id: string;
  user: UserPublic;
  body: string;
  createdAt: string;
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
