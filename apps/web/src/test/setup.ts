import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

// Registers `toHaveNoViolations` for the accessibility suite. (vitest-axe's own
// `extend-expect` entry targets Vitest 0.x internals and is a no-op here, so the
// matcher is wired manually; its types come from ./vitest-axe.d.ts.)
expect.extend(axeMatchers);

// Unmount React trees between tests so queries never see stale DOM.
afterEach(() => cleanup());
