import type { AuthResponse, UserPublic } from '@runturf/shared';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_TTL, config, REFRESH_TOKEN_TTL_DAYS } from '../config.js';
import { db } from '../db/client.js';
import { refreshTokens, users, userStats } from '../db/schema.js';
import { badRequest, conflict, unauthorized } from '../errors.js';

const USER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
];

export function toPublic(u: typeof users.$inferSelect): UserPublic {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    color: u.color,
    createdAt: u.createdAt.toISOString(),
  };
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
    return payload.sub;
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400_000);
  await db.insert(refreshTokens).values({ userId, tokenHash: hashToken(token), expiresAt });
  return token;
}

async function buildAuthResponse(user: typeof users.$inferSelect): Promise<AuthResponse> {
  return {
    user: toPublic(user),
    accessToken: signAccessToken(user.id),
    refreshToken: await issueRefreshToken(user.id),
  };
}

export async function register(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw badRequest('Username must be 3-24 chars: letters, numbers, underscore');
  }
  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) throw conflict('Username already taken');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  const [user] = await db
    .insert(users)
    .values({
      username,
      displayName: input.displayName?.trim() || username,
      passwordHash,
      color,
    })
    .returning();
  await db.insert(userStats).values({ userId: user.id });
  return buildAuthResponse(user);
}

export async function login(input: { username: string; password: string }): Promise<AuthResponse> {
  const username = input.username.trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw unauthorized('Invalid username or password');
  }
  return buildAuthResponse(user);
}

/** Rotates the refresh token: the presented token is revoked and a new one issued. */
export async function refresh(token: string): Promise<AuthResponse> {
  const row = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, hashToken(token)),
  });
  if (!row || row.expiresAt < new Date()) throw unauthorized('Invalid refresh token');
  await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!user) throw unauthorized('User no longer exists');
  return buildAuthResponse(user);
}
