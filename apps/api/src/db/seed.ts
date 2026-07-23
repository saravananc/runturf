import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { config } from '../config.js';
import { ensureWeeklyChallenges } from '../services/challenges.js';
import { db, pool } from './client.js';
import { achievements, shopItems, users, userStats } from './schema.js';

const ACHIEVEMENTS = [
  { code: 'first_run', title: 'First Steps', description: 'Complete your first run', icon: '👟', xpReward: 50, sortOrder: 1 },
  { code: 'run_5k', title: '5K Finisher', description: 'Complete a single run of 5 km or more', icon: '🏃', xpReward: 100, sortOrder: 2 },
  { code: 'run_10k', title: '10K Warrior', description: 'Complete a single run of 10 km or more', icon: '💪', xpReward: 200, sortOrder: 3 },
  { code: 'total_50k', title: 'Road Veteran', description: 'Run 50 km in total', icon: '🛣️', xpReward: 250, sortOrder: 4 },
  { code: 'first_capture', title: 'Land Grab', description: 'Capture your first territory cell', icon: '🚩', xpReward: 50, sortOrder: 5 },
  { code: 'cells_10', title: 'Landlord', description: 'Own 10 territory cells at once', icon: '🏘️', xpReward: 100, sortOrder: 6 },
  { code: 'cells_50', title: 'Baron', description: 'Own 50 territory cells at once', icon: '🏰', xpReward: 300, sortOrder: 7 },
  { code: 'first_steal', title: 'Conqueror', description: 'Steal a cell from another runner', icon: '⚔️', xpReward: 75, sortOrder: 8 },
  { code: 'streak_3', title: 'Habit Forming', description: 'Run 3 days in a row', icon: '🔥', xpReward: 100, sortOrder: 9 },
  { code: 'streak_7', title: 'On Fire', description: 'Run 7 days in a row', icon: '🌋', xpReward: 250, sortOrder: 10 },
  { code: 'runs_10', title: 'Regular', description: 'Complete 10 runs', icon: '📅', xpReward: 150, sortOrder: 11 },
  { code: 'level_5', title: 'Rising Star', description: 'Reach level 5', icon: '⭐', xpReward: 0, sortOrder: 12 },
];

/**
 * Whether to seed the demo/rival accounts (which share the well-known password
 * `demo1234`). They must never exist in production unless explicitly opted in.
 * `SEED_DEMO` overrides in either direction; otherwise demo data is dev-only.
 */
export function shouldSeedDemoUsers(env: {
  NODE_ENV: string;
  SEED_DEMO?: string;
}): boolean {
  if (env.SEED_DEMO === 'true') return true;
  if (env.SEED_DEMO === 'false') return false;
  return env.NODE_ENV !== 'production';
}

const SHOP_ITEMS = [
  {
    code: 'xp_boost',
    name: 'XP Boost',
    description: 'Double the XP earned on your next run',
    icon: '⚡',
    cost: 50,
    sortOrder: 1,
  },
  {
    code: 'streak_freeze',
    name: 'Streak Freeze',
    description: 'Save your streak if you miss a day',
    icon: '🧊',
    cost: 75,
    sortOrder: 2,
  },
];

/** Reference data every environment needs: achievements, shop items, challenges. */
export async function seedReferenceData(): Promise<void> {
  await db.insert(achievements).values(ACHIEVEMENTS).onConflictDoNothing();
  await db.insert(shopItems).values(SHOP_ITEMS).onConflictDoNothing();
  // Same generator the API uses at runtime, so seed and runtime never diverge.
  await ensureWeeklyChallenges();
}

/** Demo accounts for local development and previews only. */
export async function seedDemoUsers(): Promise<void> {
  const demoUsers = [
    { username: 'demo', displayName: 'Demo Runner', color: '#3b82f6' },
    { username: 'rival', displayName: 'Rival Runner', color: '#ef4444' },
  ];
  const passwordHash = await bcrypt.hash('demo1234', 10);
  for (const u of demoUsers) {
    const [row] = await db
      .insert(users)
      .values({ ...u, passwordHash })
      .onConflictDoNothing()
      .returning();
    if (row) await db.insert(userStats).values({ userId: row.id }).onConflictDoNothing();
  }
}

async function main() {
  await seedReferenceData();

  const seedDemo = shouldSeedDemoUsers({
    NODE_ENV: config.NODE_ENV,
    SEED_DEMO: process.env.SEED_DEMO,
  });
  if (seedDemo) {
    await seedDemoUsers();
  } else {
    console.log('Skipping demo accounts (production, or SEED_DEMO=false).');
  }

  const counts = await db.execute(
    sql`SELECT (SELECT count(*) FROM achievements) AS achievements,
               (SELECT count(*) FROM challenges) AS challenges,
               (SELECT count(*) FROM users) AS users`,
  );
  console.log('Seeded:', counts.rows[0]);
  await pool.end();
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
