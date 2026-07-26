import type { AnalyticsEvent, AnalyticsEventName, AnalyticsProps } from '@runturf/shared';
import { AppState } from 'react-native';
import { post } from './api';

/**
 * Lightweight first-party analytics. Events buffer and flush as a batch to
 * POST /events (which attributes them to the signed-in user server-side).
 * Best-effort throughout: a failed flush drops the batch rather than retrying,
 * so analytics never affects the user-facing flow. Pure HTTP — no native module.
 */
const buffer: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_MS = 5000;
const MAX_BATCH = 50;

export function track(name: AnalyticsEventName, props?: AnalyticsProps): void {
  buffer.push({ name, props, ts: Date.now() });
  if (buffer.length >= MAX_BATCH) {
    void flush();
    return;
  }
  timer ??= setTimeout(() => void flush(), FLUSH_MS);
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);
  try {
    await post('/events', { source: 'mobile', events });
  } catch {
    // Best-effort: drop on failure rather than blocking or retrying forever.
  }
}

// Flush when the app is backgrounded so buffered events aren't lost.
AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') void flush();
});
