import * as Sentry from '@sentry/node';
import { config } from './config.js';
import { logger } from './logger.js';

let enabled = false;

/** Initialises crash reporting when SENTRY_DSN is set; otherwise a no-op. */
export function initObservability(): void {
  if (!config.SENTRY_DSN) return;
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: 0, // errors only for now — no performance tracing
  });
  enabled = true;
  logger.info('Crash reporting enabled (Sentry)');
}

/** Reports an exception when reporting is enabled; otherwise does nothing. */
export function captureException(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}

/**
 * Flushes any buffered events then resolves. Call before a deliberate exit so a
 * fatal error isn't lost. Resolves immediately when reporting is disabled.
 */
export async function flushObservability(timeoutMs = 2000): Promise<void> {
  if (enabled) await Sentry.close(timeoutMs);
}
