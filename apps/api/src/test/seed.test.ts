import { describe, expect, it } from 'vitest';
import { shouldSeedDemoUsers } from '../db/seed.js';

describe('shouldSeedDemoUsers', () => {
  it('seeds demo accounts in development and test', () => {
    expect(shouldSeedDemoUsers({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldSeedDemoUsers({ NODE_ENV: 'test' })).toBe(true);
  });

  it('never seeds demo accounts in production by default', () => {
    expect(shouldSeedDemoUsers({ NODE_ENV: 'production' })).toBe(false);
  });

  it('SEED_DEMO overrides in both directions', () => {
    // Explicit opt-in even in production (e.g. a staging/preview box).
    expect(shouldSeedDemoUsers({ NODE_ENV: 'production', SEED_DEMO: 'true' })).toBe(true);
    // Explicit opt-out even in development.
    expect(shouldSeedDemoUsers({ NODE_ENV: 'development', SEED_DEMO: 'false' })).toBe(false);
  });
});
