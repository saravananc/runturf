import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler } from './middleware.js';
import { authRouter } from './routes/auth.js';
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

  app.use(errorHandler);
  return app;
}
