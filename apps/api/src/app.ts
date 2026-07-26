import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { errorHandler } from './middleware.js';
import { eventsRouter } from './routes/analytics.js';
import { authRouter } from './routes/auth.js';
import { clubsRouter } from './routes/clubs.js';
import {
  achievementsRouter,
  challengesRouter,
  myAchievementsRouter,
} from './routes/gamification.js';
import { runsRouter } from './routes/runs.js';
import { shopRouter } from './routes/shop.js';
import { socialRouter } from './routes/social.js';
import { territoryRouter } from './routes/territory.js';
import { usersRouter } from './routes/users.js';

/**
 * Credential endpoints are the brute-force surface, so they get a tight limit.
 * Disabled under NODE_ENV=test: the suites make many rapid auth calls by design.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  message: { error: 'Too many attempts — try again in a few minutes' },
});

/** Broad ceiling for everything else, so a single client cannot flood the API. */
const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
});

export function createApp() {
  const app = express();
  // Trust the reverse proxy so rate limiting keys on the real client IP in production.
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  // Request logging. Quiet in tests, and health checks are noise at any level.
  if (config.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' },
        // Never let a bearer token or password reach the logs.
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
        // One concise line per request; full headers are noise at every level.
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ status: res.statusCode }),
        },
        customLogLevel: (_req, res, err) =>
          err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      }),
    );
  }
  app.use(cors({ origin: config.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '10mb' })); // run point arrays can be large
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/auth/login', authLimiter);
  app.use('/auth/register', authLimiter);
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/users/me/achievements', myAchievementsRouter);
  app.use('/runs', runsRouter);
  app.use('/territory', territoryRouter);
  app.use('/achievements', achievementsRouter);
  app.use('/challenges', challengesRouter);
  app.use('/social', socialRouter);
  app.use('/clubs', clubsRouter);
  app.use('/shop', shopRouter);
  app.use('/events', eventsRouter);

  app.use(errorHandler);
  return app;
}
