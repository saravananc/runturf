import type { ClubDetail, ClubMessage, ClubSummary } from '@runturf/shared';
import { and, asc, count, desc, eq, gte, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  cellCaptures,
  clubMembers,
  clubMessages,
  clubs,
  territoryCells,
  users,
  userStats,
} from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { toPublic } from './auth.js';

function isoWeekStart(now = new Date()): Date {
  const start = new Date(now);
  const day = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

async function myMembership(userId: string) {
  return db.query.clubMembers.findFirst({ where: eq(clubMembers.userId, userId) });
}

export async function createClub(
  userId: string,
  input: { name: string; tag: string; description?: string; color?: string },
): Promise<ClubDetail> {
  if (await myMembership(userId)) throw conflict('You are already in a club — leave it first');
  const name = input.name.trim();
  const tag = input.tag.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) throw badRequest('Tag must be 2-5 letters or digits');
  if (name.length < 3 || name.length > 32) throw badRequest('Name must be 3-32 characters');
  const clash = await db.query.clubs.findFirst({
    where: or(eq(clubs.name, name), eq(clubs.tag, tag)),
  });
  if (clash) throw conflict('A club with that name or tag already exists');
  const [club] = await db
    .insert(clubs)
    .values({
      name,
      tag,
      description: input.description?.trim() ?? '',
      color: input.color ?? '#8b5cf6',
      ownerId: userId,
    })
    .returning();
  await db.insert(clubMembers).values({ clubId: club.id, userId, role: 'owner' });
  return getClub(userId, club.id);
}

async function clubStats(clubIds: string[]) {
  if (clubIds.length === 0) {
    return { members: new Map(), cells: new Map(), weekly: new Map() };
  }
  const memberRows = await db
    .select({ clubId: clubMembers.clubId, n: count() })
    .from(clubMembers)
    .where(inArray(clubMembers.clubId, clubIds))
    .groupBy(clubMembers.clubId);
  const cellRows = await db
    .select({ clubId: clubMembers.clubId, n: count() })
    .from(territoryCells)
    .innerJoin(clubMembers, eq(clubMembers.userId, territoryCells.ownerId))
    .where(inArray(clubMembers.clubId, clubIds))
    .groupBy(clubMembers.clubId);
  const weeklyRows = await db
    .select({ clubId: clubMembers.clubId, n: count() })
    .from(cellCaptures)
    .innerJoin(clubMembers, eq(clubMembers.userId, cellCaptures.newOwnerId))
    .where(
      and(inArray(clubMembers.clubId, clubIds), gte(cellCaptures.capturedAt, isoWeekStart())),
    )
    .groupBy(clubMembers.clubId);
  return {
    members: new Map(memberRows.map((r) => [r.clubId, Number(r.n)])),
    cells: new Map(cellRows.map((r) => [r.clubId, Number(r.n)])),
    weekly: new Map(weeklyRows.map((r) => [r.clubId, Number(r.n)])),
  };
}

function toSummary(
  c: typeof clubs.$inferSelect,
  stats: Awaited<ReturnType<typeof clubStats>>,
): ClubSummary {
  return {
    id: c.id,
    name: c.name,
    tag: c.tag,
    description: c.description,
    color: c.color,
    memberCount: stats.members.get(c.id) ?? 0,
    cellsOwned: stats.cells.get(c.id) ?? 0,
    weeklyCellsCaptured: stats.weekly.get(c.id) ?? 0,
  };
}

/** Browse clubs, ranked by turf owned (the standing "battle" leaderboard). */
export async function listClubs(q?: string): Promise<ClubSummary[]> {
  const rows = await db.query.clubs.findMany({
    where: q ? or(ilike(clubs.name, `%${q}%`), ilike(clubs.tag, `%${q}%`)) : undefined,
    limit: 50,
  });
  const stats = await clubStats(rows.map((c) => c.id));
  return rows
    .map((c) => toSummary(c, stats))
    .sort((a, b) => b.cellsOwned - a.cellsOwned || b.weeklyCellsCaptured - a.weeklyCellsCaptured);
}

export async function getClub(userId: string, clubId: string): Promise<ClubDetail> {
  const club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
  if (!club) throw notFound('Club not found');
  const stats = await clubStats([clubId]);
  const memberRows = await db
    .select({ user: users, role: clubMembers.role, level: userStats.level })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .innerJoin(userStats, eq(userStats.userId, users.id))
    .where(eq(clubMembers.clubId, clubId))
    .orderBy(asc(clubMembers.joinedAt));
  const owned = await db
    .select({ ownerId: territoryCells.ownerId, n: count() })
    .from(territoryCells)
    .where(
      inArray(
        territoryCells.ownerId,
        memberRows.map((m) => m.user.id),
      ),
    )
    .groupBy(territoryCells.ownerId);
  const ownedById = new Map(owned.map((o) => [o.ownerId, Number(o.n)]));
  const mine = memberRows.find((m) => m.user.id === userId);
  return {
    ...toSummary(club, stats),
    ownerId: club.ownerId,
    myRole: (mine?.role as 'owner' | 'member' | undefined) ?? null,
    members: memberRows.map((m) => ({
      ...toPublic(m.user),
      role: m.role,
      level: m.level,
      cellsOwned: ownedById.get(m.user.id) ?? 0,
    })),
  };
}

export async function getMyClub(userId: string): Promise<ClubDetail | null> {
  const membership = await myMembership(userId);
  return membership ? getClub(userId, membership.clubId) : null;
}

export async function joinClub(userId: string, clubId: string): Promise<void> {
  if (await myMembership(userId)) throw conflict('You are already in a club');
  const club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
  if (!club) throw notFound('Club not found');
  await db.insert(clubMembers).values({ clubId, userId, role: 'member' });
}

export async function leaveClub(userId: string): Promise<void> {
  const membership = await myMembership(userId);
  if (!membership) throw notFound('You are not in a club');
  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, membership.clubId), eq(clubMembers.userId, userId)));

  const remaining = await db.query.clubMembers.findMany({
    where: eq(clubMembers.clubId, membership.clubId),
    orderBy: [asc(clubMembers.joinedAt)],
  });
  if (remaining.length === 0) {
    await db.delete(clubs).where(eq(clubs.id, membership.clubId));
  } else if (membership.role === 'owner') {
    // ownership passes to the longest-standing member
    const heir = remaining[0];
    await db
      .update(clubMembers)
      .set({ role: 'owner' })
      .where(and(eq(clubMembers.clubId, heir.clubId), eq(clubMembers.userId, heir.userId)));
    await db.update(clubs).set({ ownerId: heir.userId }).where(eq(clubs.id, heir.clubId));
  }
}

export async function listMessages(userId: string, clubId: string): Promise<ClubMessage[]> {
  const membership = await myMembership(userId);
  if (!membership || membership.clubId !== clubId) throw forbidden('Members only');
  const rows = await db
    .select({ m: clubMessages, user: users })
    .from(clubMessages)
    .innerJoin(users, eq(users.id, clubMessages.userId))
    .where(eq(clubMessages.clubId, clubId))
    .orderBy(desc(clubMessages.createdAt))
    .limit(50);
  return rows.reverse().map((r) => ({
    id: r.m.id,
    user: toPublic(r.user),
    body: r.m.body,
    createdAt: r.m.createdAt.toISOString(),
  }));
}

export async function postMessage(
  userId: string,
  clubId: string,
  body: string,
): Promise<ClubMessage> {
  const membership = await myMembership(userId);
  if (!membership || membership.clubId !== clubId) throw forbidden('Members only');
  const text = body.trim();
  if (!text || text.length > 500) throw badRequest('Message must be 1-500 characters');
  const [row] = await db.insert(clubMessages).values({ clubId, userId, body: text }).returning();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return {
    id: row.id,
    user: toPublic(user!),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}