import type { FeedItem, FriendEntry, FriendRequest, UserPublic } from '@runturf/shared';
import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, runs, territoryCells, users, userStats } from '../db/schema.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { toPublic } from './auth.js';

export async function searchUsers(userId: string, q: string): Promise<UserPublic[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await db.query.users.findMany({
    where: and(
      ne(users.id, userId),
      eq(users.discoverable, true), // users who opted out of discovery stay hidden
      or(ilike(users.username, `%${term}%`), ilike(users.displayName, `%${term}%`)),
    ),
    limit: 10,
  });
  return rows.map(toPublic);
}

/** The friendship row between two users regardless of direction, if any. */
async function findPair(a: string, b: string) {
  return db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
      and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
    ),
  });
}

export async function sendFriendRequest(userId: string, username: string): Promise<void> {
  const target = await db.query.users.findFirst({
    where: eq(users.username, username.trim().toLowerCase()),
  });
  if (!target) throw notFound('User not found');
  if (target.id === userId) throw badRequest('You cannot befriend yourself');
  const existing = await findPair(userId, target.id);
  if (existing) {
    throw conflict(existing.status === 'accepted' ? 'Already friends' : 'Request already pending');
  }
  await db.insert(friendships).values({ requesterId: userId, addresseeId: target.id });
}

export async function respondToRequest(
  userId: string,
  requestId: string,
  accept: boolean,
): Promise<void> {
  const req = await db.query.friendships.findFirst({ where: eq(friendships.id, requestId) });
  if (!req || req.addresseeId !== userId || req.status !== 'pending') {
    throw notFound('Request not found');
  }
  if (accept) {
    await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, requestId));
  } else {
    await db.delete(friendships).where(eq(friendships.id, requestId));
  }
}

export async function listRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await db
    .select({ f: friendships, requester: users })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, 'pending')));
  const incoming: FriendRequest[] = rows.map((r) => ({
    id: r.f.id,
    user: toPublic(r.requester),
    direction: 'incoming',
    createdAt: r.f.createdAt.toISOString(),
  }));
  const out = await db
    .select({ f: friendships, addressee: users })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(and(eq(friendships.requesterId, userId), eq(friendships.status, 'pending')));
  const outgoing: FriendRequest[] = out.map((r) => ({
    id: r.f.id,
    user: toPublic(r.addressee),
    direction: 'outgoing',
    createdAt: r.f.createdAt.toISOString(),
  }));
  return [...incoming, ...outgoing];
}

async function friendIds(userId: string): Promise<string[]> {
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'accepted'),
      or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
    ),
  });
  return rows.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
}

export async function listFriends(userId: string): Promise<FriendEntry[]> {
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'accepted'),
      or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
    ),
  });
  if (rows.length === 0) return [];
  const ids = rows.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
  const sinceById = new Map(
    rows.map((f) => [
      f.requesterId === userId ? f.addresseeId : f.requesterId,
      f.createdAt.toISOString(),
    ]),
  );
  const friends = await db
    .select({ user: users, level: userStats.level, totalDistanceM: userStats.totalDistanceM })
    .from(users)
    .innerJoin(userStats, eq(userStats.userId, users.id))
    .where(inArray(users.id, ids));
  const owned = await db
    .select({ ownerId: territoryCells.ownerId, cells: count() })
    .from(territoryCells)
    .where(inArray(territoryCells.ownerId, ids))
    .groupBy(territoryCells.ownerId);
  const ownedById = new Map(owned.map((o) => [o.ownerId, Number(o.cells)]));
  return friends.map((f) => ({
    user: toPublic(f.user),
    since: sinceById.get(f.user.id) ?? '',
    level: f.level,
    cellsOwned: ownedById.get(f.user.id) ?? 0,
    totalDistanceM: f.totalDistanceM,
  }));
}

export async function removeFriend(userId: string, otherId: string): Promise<void> {
  const pair = await findPair(userId, otherId);
  if (!pair || pair.status !== 'accepted') throw notFound('Friendship not found');
  await db.delete(friendships).where(eq(friendships.id, pair.id));
}

export async function getFeed(userId: string): Promise<FeedItem[]> {
  const ids = [userId, ...(await friendIds(userId))];
  const rows = await db
    .select({ run: runs, user: users })
    .from(runs)
    .innerJoin(users, eq(users.id, runs.userId))
    // Always show your own runs; a friend's only if they share their activity.
    .where(and(inArray(runs.userId, ids), or(eq(runs.userId, userId), eq(users.shareActivity, true))))
    .orderBy(desc(runs.startedAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.run.id,
    user: toPublic(r.user),
    startedAt: r.run.startedAt.toISOString(),
    distanceM: r.run.distanceM,
    durationS: r.run.durationS,
    avgPaceSPerKm: r.run.avgPaceSPerKm,
    cellsCaptured: r.run.cellsCaptured,
    cellsStolen: r.run.cellsStolen,
    xpGained: r.run.xpGained,
  }));
}
