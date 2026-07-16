import type { NextFunction, Request, Response } from 'express';
import { z, ZodError, type ZodSchema } from 'zod';
import { HttpError, unauthorized } from './errors.js';
import { logger } from './logger.js';
import { verifyAccessToken } from './services/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId: string;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized('Missing bearer token'));
  try {
    req.userId = verifyAccessToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
}

/** Wraps an async handler so rejections reach the error middleware. */
export function h(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

const Uuid = z.string().uuid();

/** Validates and returns a UUID route param (Express 5 types params loosely). */
export function idParam(value: unknown): string {
  return Uuid.parse(value);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
