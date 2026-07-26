import * as Sentry from '@sentry/react';

/**
 * Initialises browser crash reporting when VITE_SENTRY_DSN is set at build time;
 * otherwise a no-op, so local dev and CI builds never emit.
 */
export function initObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0, // errors only for now
  });
}
