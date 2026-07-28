import type { AxeMatchers } from 'vitest-axe/matchers';

/**
 * vitest-axe@0.1 still augments the legacy global `Vi` namespace, which Vitest 2
 * no longer reads, so `toHaveNoViolations` is registered at runtime but invisible
 * to the type checker. Re-declare it the modern way.
 */
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
