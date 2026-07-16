import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, pool } from './client.js';
import { achievements, challenges, users, userStats } from './schema.js';

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

function weekBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  const day = (start.getUTCDay() + 6) % 7; // Monday = 0
  start.setUTCDate(start.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

async function main() {
  await db.insert(achievements).values(ACHIEVEMENTS).onConflictDoNothing();

  const { start, end } = weekBounds();
  const weekTag = start.toISOString().slice(0, 10);
  await db
    .insert(challenges)
    .values([
      {
        code: `weekly_distance_${weekTag}`,
        title: 'Weekly 15K',
        description: 'Run a total of 15 km this week',
        metric: 'distance_m',
        target: 15000,
        startsAt: start,
        endsAt: end,
        coinReward: 50,
        xpReward: 200,
      },
      {
        code: `weekly_cells_${weekTag}`,
        title: 'Turf War',
        description: 'Capture 25 cells this week',
        metric: 'cells_captured',
        target: 25,
        startsAt: start,
        endsAt: end,
        coinReward: 75,
        xpReward: 250,
      },
    ])
    .onConflictDoNothing();

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

  const counts = await db.execute(
    sql`SELECT (SELECT count(*) FROM achievements) AS achievements,
               (SELECT count(*) FROM challenges) AS challenges,
               (SELECT count(*) FROM users) AS users`,
  );
  console.log('Seeded:', counts.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
