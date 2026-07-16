import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const config = Env.parse(process.env);

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 30;
