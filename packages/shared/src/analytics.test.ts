import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENTS } from './analytics.js';

describe('analytics contract', () => {
  it('exposes a stable, de-duplicated set of event names', () => {
    // A couple of anchors so an accidental rename is caught here, not in prod.
    expect(ANALYTICS_EVENTS).toContain('app_opened');
    expect(ANALYTICS_EVENTS).toContain('run_submitted');
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});
