import {
  isoWeekStart,
  type ClubBattle,
  type ClubBattleClub,
  type ClubDetail,
  type ClubEvent,
  type ClubInvite,
  type ClubMessage,
  type ClubSummary,
} from '@runturf/shared';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  cellCaptures,
  clubBattles,
  clubEventRsvps,
  clubEvents,
  clubInvites,
  clubMembers,
  clubMessages,
  clubs,
  territoryCells,
  users,
  userStats,
} from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { toPublic } from './auth.js';

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

/* ---------- invites & moderation (owner-only actions) ---------- */

/** Throws unless `userId` owns `clubId`. */
async function requireOwner(userId: string, clubId: string) {
  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)),
  });
  if (!membership || membership.role !== 'owner') throw forbidden('Only the club owner can do that');
  return membership;
}

/** Owner invites a runner by username. Accept enforces the one-club rule. */
export async function inviteToClub(
  ownerId: string,
  clubId: string,
  username: string,
): Promise<void> {
  await requireOwner(ownerId, clubId);
  const invitee = await db.query.users.findFirst({
    where: eq(users.username, username.trim().toLowerCase()),
  });
  if (!invitee) throw notFound('User not found');
  if (invitee.id === ownerId) throw badRequest('You are already in this club');

  const alreadyMember = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, invitee.id)),
  });
  if (alreadyMember) throw conflict('They are already a member');

  await db
    .insert(clubInvites)
    .values({ clubId, inviterId: ownerId, inviteeId: invitee.id })
    .onConflictDoNothing({ target: [clubInvites.clubId, clubInvites.inviteeId] });
}

/** Pending club invites addressed to a user. */
export async function listMyInvites(userId: string): Promise<ClubInvite[]> {
  const rows = await db
    .select({ invite: clubInvites, club: clubs, inviter: users })
    .from(clubInvites)
    .innerJoin(clubs, eq(clubs.id, clubInvites.clubId))
    .innerJoin(users, eq(users.id, clubInvites.inviterId))
    .where(eq(clubInvites.inviteeId, userId))
    .orderBy(desc(clubInvites.createdAt));
  if (rows.length === 0) return [];

  const stats = await clubStats(rows.map((r) => r.club.id));
  return rows.map((r) => ({
    id: r.invite.id,
    club: toSummary(r.club, stats),
    inviter: toPublic(r.inviter),
    createdAt: r.invite.createdAt.toISOString(),
  }));
}

export async function respondToInvite(
  userId: string,
  inviteId: string,
  accept: boolean,
): Promise<void> {
  const invite = await db.query.clubInvites.findFirst({ where: eq(clubInvites.id, inviteId) });
  if (!invite || invite.inviteeId !== userId) throw notFound('Invite not found');
  if (accept) {
    // joinClub enforces "one club per user"; only clear the invite once joined.
    await joinClub(userId, invite.clubId);
  }
  await db.delete(clubInvites).where(eq(clubInvites.id, inviteId));
}

/** Owner removes a member (cannot remove themselves — use leave). */
export async function kickMember(
  ownerId: string,
  clubId: string,
  targetId: string,
): Promise<void> {
  await requireOwner(ownerId, clubId);
  if (targetId === ownerId) throw badRequest('Use “leave” to remove yourself');
  const target = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetId)),
  });
  if (!target) throw notFound('Member not found');
  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetId)));
}

/** Owner hands ownership to another member and becomes a member themselves. */
export async function transferOwnership(
  ownerId: string,
  clubId: string,
  targetId: string,
): Promise<void> {
  await requireOwner(ownerId, clubId);
  if (targetId === ownerId) throw badRequest('You already own this club');
  const target = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetId)),
  });
  if (!target) throw notFound('Member not found');

  await db.transaction(async (tx) => {
    await tx
      .update(clubMembers)
      .set({ role: 'owner' })
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetId)));
    await tx
      .update(clubMembers)
      .set({ role: 'member' })
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, ownerId)));
    await tx.update(clubs).set({ ownerId: targetId }).where(eq(clubs.id, clubId));
  });
}

/* ---------- club battles (owner-proposed head-to-head turf wars) ---------- */

/** Coins awarded to each member of the winning club when a battle finishes. */
const BATTLE_REWARD_COINS = 100;

/** Cells a club's members captured in [from, to] — a side's battle score. */
async function battleScore(clubId: string, from: Date, to: Date): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(cellCaptures)
    .innerJoin(clubMembers, eq(clubMembers.userId, cellCaptures.newOwnerId))
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        gte(cellCaptures.capturedAt, from),
        lte(cellCaptures.capturedAt, to),
      ),
    );
  return Number(n);
}

function toBattleClub(c: typeof clubs.$inferSelect): ClubBattleClub {
  return { id: c.id, name: c.name, tag: c.tag, color: c.color };
}

async function toBattle(b: typeof clubBattles.$inferSelect): Promise<ClubBattle> {
  const [challenger, opponent] = await Promise.all([
    db.query.clubs.findFirst({ where: eq(clubs.id, b.challengerClubId) }),
    db.query.clubs.findFirst({ where: eq(clubs.id, b.opponentClubId) }),
  ]);
  let challengerScore = b.challengerScore;
  let opponentScore = b.opponentScore;
  // While active the score is live; the row's frozen value is only meaningful
  // once finished.
  if (b.status === 'active' && b.startsAt && b.endsAt) {
    const to = new Date(Math.min(Date.now(), b.endsAt.getTime()));
    [challengerScore, opponentScore] = await Promise.all([
      battleScore(b.challengerClubId, b.startsAt, to),
      battleScore(b.opponentClubId, b.startsAt, to),
    ]);
  }
  return {
    id: b.id,
    status: b.status as ClubBattle['status'],
    challenger: toBattleClub(challenger!),
    opponent: toBattleClub(opponent!),
    challengerScore,
    opponentScore,
    durationHours: b.durationHours,
    startsAt: b.startsAt?.toISOString() ?? null,
    endsAt: b.endsAt?.toISOString() ?? null,
    winnerClubId: b.winnerClubId,
    createdAt: b.createdAt.toISOString(),
  };
}

/** A club owner challenges another club to a turf war of the given length. */
export async function proposeBattle(
  userId: string,
  opponentClubId: string,
  durationHours: number,
): Promise<ClubBattle> {
  const membership = await myMembership(userId);
  if (!membership || membership.role !== 'owner') {
    throw forbidden('Only a club owner can start a battle');
  }
  const challengerClubId = membership.clubId;
  if (opponentClubId === challengerClubId) throw badRequest('Pick a different club to battle');
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 168) {
    throw badRequest('Duration must be 1–168 hours');
  }
  const opponent = await db.query.clubs.findFirst({ where: eq(clubs.id, opponentClubId) });
  if (!opponent) throw notFound('Opponent club not found');

  // At most one open battle per pair, in either direction.
  const open = await db.query.clubBattles.findFirst({
    where: and(
      inArray(clubBattles.status, ['proposed', 'active']),
      or(
        and(
          eq(clubBattles.challengerClubId, challengerClubId),
          eq(clubBattles.opponentClubId, opponentClubId),
        ),
        and(
          eq(clubBattles.challengerClubId, opponentClubId),
          eq(clubBattles.opponentClubId, challengerClubId),
        ),
      ),
    ),
  });
  if (open) throw conflict('A battle between these clubs is already open');

  const [battle] = await db
    .insert(clubBattles)
    .values({ challengerClubId, opponentClubId, durationHours, status: 'proposed' })
    .returning();
  return toBattle(battle);
}

/** The challenged club's owner accepts (starting the window) or declines. */
export async function respondToBattle(
  userId: string,
  battleId: string,
  accept: boolean,
): Promise<ClubBattle> {
  const battle = await db.query.clubBattles.findFirst({ where: eq(clubBattles.id, battleId) });
  if (!battle) throw notFound('Battle not found');
  if (battle.status !== 'proposed') throw badRequest('This battle has already been answered');
  await requireOwner(userId, battle.opponentClubId); // only the challenged owner may respond

  if (!accept) {
    const [row] = await db
      .update(clubBattles)
      .set({ status: 'declined' })
      .where(eq(clubBattles.id, battleId))
      .returning();
    return toBattle(row);
  }
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + battle.durationHours * 3_600_000);
  const [row] = await db
    .update(clubBattles)
    .set({ status: 'active', startsAt, endsAt })
    .where(eq(clubBattles.id, battleId))
    .returning();
  return toBattle(row);
}

/**
 * Finishes any active battle whose window has closed: freezes each side's score,
 * records the winner (null on a tie), and awards coins to the winners. Called
 * lazily before listing, mirroring the challenge lifecycle. The status guard on
 * the update makes concurrent calls settle a battle — and pay out — exactly once.
 */
export async function finishDueBattles(): Promise<void> {
  const due = await db.query.clubBattles.findMany({
    where: and(eq(clubBattles.status, 'active'), lte(clubBattles.endsAt, new Date())),
  });
  for (const b of due) {
    const [challengerScore, opponentScore] = await Promise.all([
      battleScore(b.challengerClubId, b.startsAt!, b.endsAt!),
      battleScore(b.opponentClubId, b.startsAt!, b.endsAt!),
    ]);
    const winnerClubId =
      challengerScore === opponentScore
        ? null
        : challengerScore > opponentScore
          ? b.challengerClubId
          : b.opponentClubId;

    await db.transaction(async (tx) => {
      const [settled] = await tx
        .update(clubBattles)
        .set({ status: 'finished', challengerScore, opponentScore, winnerClubId })
        .where(and(eq(clubBattles.id, b.id), eq(clubBattles.status, 'active')))
        .returning();
      if (!settled || !winnerClubId) return; // lost the race, or a tie: no payout

      const winners = await tx
        .select({ userId: clubMembers.userId })
        .from(clubMembers)
        .where(eq(clubMembers.clubId, winnerClubId));
      if (winners.length > 0) {
        await tx
          .update(userStats)
          .set({ coins: sql`${userStats.coins} + ${BATTLE_REWARD_COINS}` })
          .where(
            inArray(
              userStats.userId,
              winners.map((w) => w.userId),
            ),
          );
      }
    });
  }
}

/** All battles a club is part of (newest first), settling any that are due. */
export async function listClubBattles(clubId: string): Promise<ClubBattle[]> {
  await finishDueBattles();
  const rows = await db.query.clubBattles.findMany({
    where: or(eq(clubBattles.challengerClubId, clubId), eq(clubBattles.opponentClubId, clubId)),
    orderBy: [desc(clubBattles.createdAt)],
    limit: 50,
  });
  return Promise.all(rows.map(toBattle));
}

/* ---------- club events (scheduled meet-ups) ---------- */

/** Throws unless `userId` belongs to `clubId`; returns their membership. */
async function requireMember(userId: string, clubId: string) {
  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)),
  });
  if (!membership) throw forbidden('Members only');
  return membership;
}

/** Events for a club, soonest first, with RSVP counts and the viewer's answer. */
export async function listClubEvents(userId: string, clubId: string): Promise<ClubEvent[]> {
  await requireMember(userId, clubId);
  const rows = await db
    .select({ e: clubEvents, creator: users })
    .from(clubEvents)
    .innerJoin(users, eq(users.id, clubEvents.createdBy))
    .where(eq(clubEvents.clubId, clubId))
    .orderBy(asc(clubEvents.startsAt))
    .limit(50);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.e.id);
  const [counts, mine] = await Promise.all([
    db
      .select({ eventId: clubEventRsvps.eventId, n: count() })
      .from(clubEventRsvps)
      .where(and(inArray(clubEventRsvps.eventId, ids), eq(clubEventRsvps.going, true)))
      .groupBy(clubEventRsvps.eventId),
    db.query.clubEventRsvps.findMany({
      where: and(inArray(clubEventRsvps.eventId, ids), eq(clubEventRsvps.userId, userId)),
    }),
  ]);
  const goingById = new Map(counts.map((c) => [c.eventId, Number(c.n)]));
  const mineById = new Map(mine.map((r) => [r.eventId, r.going]));

  return rows.map((r) => ({
    id: r.e.id,
    clubId: r.e.clubId,
    title: r.e.title,
    description: r.e.description,
    location: r.e.location,
    startsAt: r.e.startsAt.toISOString(),
    cancelled: r.e.cancelledAt !== null,
    createdBy: toPublic(r.creator),
    goingCount: goingById.get(r.e.id) ?? 0,
    myRsvp: mineById.get(r.e.id) ?? null,
    createdAt: r.e.createdAt.toISOString(),
  }));
}

/** Owner schedules a meet-up. */
export async function createClubEvent(
  userId: string,
  clubId: string,
  input: { title: string; description?: string; location?: string; startsAt: string },
): Promise<ClubEvent> {
  await requireOwner(userId, clubId);
  const title = input.title.trim();
  if (title.length < 3 || title.length > 80) throw badRequest('Title must be 3-80 characters');
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw badRequest('Invalid start time');
  if (startsAt.getTime() < Date.now()) throw badRequest('Event must start in the future');

  const [row] = await db
    .insert(clubEvents)
    .values({
      clubId,
      title,
      description: input.description?.trim() ?? '',
      location: input.location?.trim() ?? '',
      startsAt,
      createdBy: userId,
    })
    .returning();

  const events = await listClubEvents(userId, clubId);
  return events.find((e) => e.id === row.id)!;
}

/** Owner cancels an event. Kept (not deleted) so members see it was called off. */
export async function cancelClubEvent(userId: string, eventId: string): Promise<void> {
  const event = await db.query.clubEvents.findFirst({ where: eq(clubEvents.id, eventId) });
  if (!event) throw notFound('Event not found');
  await requireOwner(userId, event.clubId);
  if (event.cancelledAt) throw conflict('Event is already cancelled');
  await db
    .update(clubEvents)
    .set({ cancelledAt: new Date() })
    .where(eq(clubEvents.id, eventId));
}

/** A member says whether they're coming. Upserts, so answers can change. */
export async function rsvpClubEvent(
  userId: string,
  eventId: string,
  going: boolean,
): Promise<void> {
  const event = await db.query.clubEvents.findFirst({ where: eq(clubEvents.id, eventId) });
  if (!event) throw notFound('Event not found');
  await requireMember(userId, event.clubId);
  if (event.cancelledAt) throw badRequest('Event was cancelled');
  await db
    .insert(clubEventRsvps)
    .values({ eventId, userId, going })
    .onConflictDoUpdate({
      target: [clubEventRsvps.eventId, clubEventRsvps.userId],
      set: { going, respondedAt: new Date() },
    });
}