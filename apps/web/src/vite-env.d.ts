/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN for browser crash reporting. Unset → reporting is disabled. */
  readonly VITE_SENTRY_DSN?: string;
}
