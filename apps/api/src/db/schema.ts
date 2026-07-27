import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  color: text('color').notNull().default('#22c55e'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  coins: integer('coins').notNull().default(0),
  streakDays: integer('streak_days').notNull().default(0),
  lastRunDate: text('last_run_date'), // YYYY-MM-DD in user-local terms (UTC for MVP)
  totalRuns: integer('total_runs').notNull().default(0),
  totalDistanceM: doublePrecision('total_distance_m').notNull().default(0),
});

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    durationS: integer('duration_s').notNull(),
    distanceM: doublePrecision('distance_m').notNull(),
    avgPaceSPerKm: doublePrecision('avg_pace_s_per_km'),
    cellsCaptured: integer('cells_captured').notNull().default(0),
    cellsStolen: integer('cells_stolen').notNull().default(0),
    xpGained: integer('xp_gained').notNull().default(0),
    rawPoints: jsonb('raw_points').notNull(), // TrackPoint[]
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('runs_user_started_idx').on(t.userId, t.startedAt)],
);

export const territoryCells = pgTable(
  'territory_cells',
  {
    zoom: integer('zoom').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
  },
  (t) => [
    primaryKey({ columns: [t.zoom, t.x, t.y] }),
    index('territory_owner_idx').on(t.ownerId),
    index('territory_xy_idx').on(t.x, t.y),
    // Supports the decay sweep (delete cells older than the cutoff).
    index('territory_captured_idx').on(t.capturedAt),
  ],
);

export const cellCaptures = pgTable(
  'cell_captures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zoom: integer('zoom').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    newOwnerId: uuid('new_owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prevOwnerId: uuid('prev_owner_id').references(() => users.id, { onDelete: 'set null' }),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('captures_cell_idx').on(t.zoom, t.x, t.y)],
);

export const achievements = pgTable('achievements', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull().default('🏅'),
  xpReward: integer('xp_reward').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code')
      .notNull()
      .references(() => achievements.code, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('friendships_pair_idx').on(t.requesterId, t.addresseeId),
    index('friendships_addressee_idx').on(t.addresseeId),
  ],
);

export const clubs = pgTable('clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  tag: text('tag').notNull().unique(), // short uppercase handle, e.g. "WOLF"
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('#8b5cf6'),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clubMembers = pgTable(
  'club_members',
  {
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner' | 'member'
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.clubId, t.userId] }),
    // one club per user
    uniqueIndex('club_members_user_idx').on(t.userId),
  ],
);

export const clubInvites = pgTable(
  'club_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // At most one pending invite per club/invitee pair.
    uniqueIndex('club_invites_pair_idx').on(t.clubId, t.inviteeId),
    index('club_invites_invitee_idx').on(t.inviteeId),
  ],
);

export const clubMessages = pgTable(
  'club_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('club_messages_club_time_idx').on(t.clubId, t.createdAt)],
);

export const shopItems = pgTable('shop_items', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull().default('🎁'),
  cost: integer('cost').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userItems = pgTable(
  'user_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code')
      .notNull()
      .references(() => shopItems.code, { onDelete: 'cascade' }),
    // Unused consumables the runner is holding.
    quantity: integer('quantity').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Unique so weekly generation is idempotent (template slug + week tag).
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  metric: text('metric').notNull(), // 'distance_m' | 'cells_captured'
  target: doublePrecision('target').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  coinReward: integer('coin_reward').notNull().default(0),
  xpReward: integer('xp_reward').notNull().default(0),
});

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    progress: doublePrecision('progress').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.challengeId, t.userId] }),
    uniqueIndex('challenge_user_idx').on(t.challengeId, t.userId),
  ],
);

/**
 * First-party product-analytics events. userId is nullable so pre-login events
 * (e.g. app_opened) can still be recorded; it is set server-side from the bearer
 * token when present, never trusted from the client body.
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    source: text('source').notNull(), // 'web' | 'mobile' | 'api'
    props: jsonb('props'), // AnalyticsProps | null
    /** Client-reported event time; may be null. */
    clientTs: timestamp('client_ts', { withTimezone: true }),
    /** Server receipt time — the trustworthy timestamp for querying. */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('analytics_name_created_idx').on(t.name, t.createdAt),
    index('analytics_user_idx').on(t.userId),
  ],
);

/**
 * Head-to-head club battles. A club owner proposes; the challenged club's owner
 * accepts (starting the window) or declines. The score is each side's cells
 * captured within [starts_at, ends_at] — computed live from cell_captures while
 * active, then frozen onto the row when the battle finishes.
 */
export const clubBattles = pgTable(
  'club_battles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengerClubId: uuid('challenger_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    opponentClubId: uuid('opponent_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('proposed'), // proposed | active | finished | declined
    durationHours: integer('duration_hours').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }), // set on accept
    endsAt: timestamp('ends_at', { withTimezone: true }),
    challengerScore: integer('challenger_score').notNull().default(0), // frozen on finish
    opponentScore: integer('opponent_score').notNull().default(0),
    winnerClubId: uuid('winner_club_id').references(() => clubs.id, { onDelete: 'set null' }), // null = tie
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('battles_challenger_idx').on(t.challengerClubId),
    index('battles_opponent_idx').on(t.opponentClubId),
    index('battles_status_idx').on(t.status),
  ],
);
