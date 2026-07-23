import type { PurchaseResult, ShopView } from '@runturf/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, type Db } from '../db/client.js';
import { shopItems, userItems, userStats } from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Item codes that the run pipeline knows how to apply. */
export const PERK = {
  xpBoost: 'xp_boost',
  streakFreeze: 'streak_freeze',
} as const;

/** The shop catalog plus the caller's balance and holdings. */
export async function getShop(userId: string): Promise<ShopView> {
  const items = await db.query.shopItems.findMany({ orderBy: [asc(shopItems.sortOrder)] });
  const owned = await db.query.userItems.findMany({ where: eq(userItems.userId, userId) });
  const ownedByCode = new Map(owned.map((o) => [o.code, o.quantity]));
  const stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });

  return {
    coins: stats?.coins ?? 0,
    items: items.map((i) => ({
      code: i.code,
      name: i.name,
      description: i.description,
      icon: i.icon,
      cost: i.cost,
      owned: ownedByCode.get(i.code) ?? 0,
    })),
  };
}

/** Buys one of an item: guards the balance, deducts coins, grants the item — atomically. */
export async function buyItem(userId: string, code: string): Promise<PurchaseResult> {
  return db.transaction(async (tx) => {
    const item = await tx.query.shopItems.findFirst({ where: eq(shopItems.code, code) });
    if (!item) throw notFound('Item not found');

    const stats = await tx.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
    if (!stats) throw notFound('Stats not found');
    if (stats.coins < item.cost) throw badRequest('Not enough coins');

    await tx
      .update(userStats)
      .set({ coins: stats.coins - item.cost })
      .where(eq(userStats.userId, userId));

    const [row] = await tx
      .insert(userItems)
      .values({ userId, code, quantity: 1 })
      .onConflictDoUpdate({
        target: [userItems.userId, userItems.code],
        set: { quantity: sql`${userItems.quantity} + 1` },
      })
      .returning();

    return {
      coins: stats.coins - item.cost,
      item: {
        code: item.code,
        name: item.name,
        description: item.description,
        icon: item.icon,
        cost: item.cost,
        owned: row.quantity,
      },
    };
  });
}

/**
 * Consumes one unit of an item if the user holds any.
 * Returns true when a unit was consumed. Runs inside the submit transaction.
 */
export async function consumePerk(tx: Tx, userId: string, code: string): Promise<boolean> {
  // Decrement only when at least one is held; the returning row proves a hit.
  const rows = await tx
    .update(userItems)
    .set({ quantity: sql`${userItems.quantity} - 1` })
    .where(and(eq(userItems.userId, userId), eq(userItems.code, code), sql`${userItems.quantity} > 0`))
    .returning({ quantity: userItems.quantity });
  return rows.length > 0;
}
