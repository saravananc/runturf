import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { clubsRouter } from './routes/clubs.js';
import {
  achievementsRouter,
  challengesRouter,
  myAchievementsRouter,
} from './routes/gamification.js';
import { runsRouter } from './routes/runs.js';
import { socialRouter } from './routes/social.js';
import { territoryRouter } from './routes/territory.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '10mb' })); // run point arrays can be large

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/users/me/achievements', myAchievementsRouter);
  app.use('/runs', runsRouter);
  app.use('/territory', territoryRouter);
  app.use('/achievements', achievementsRouter);
  app.use('/challenges', challengesRouter);
  app.use('/social', socialRouter);
  app.use('/clubs', clubsRouter);

  app.use(errorHandler);
  return app;
}
