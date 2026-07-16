import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // PostGIS system tables must not be treated as drizzle-managed
  tablesFilter: ['!spatial_ref_sys', '!geography_columns', '!geometry_columns'],
});
