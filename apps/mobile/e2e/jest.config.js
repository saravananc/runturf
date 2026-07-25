/**
 * Detox drives a real device, so these specs run in Detox's own environment —
 * separate from the jest-expo unit suite in screens/__tests__ and __tests__.
 * `npm test` excludes this directory; use `npm run e2e` to run it.
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 300000, // device + network + several polled waits per test
  maxWorkers: 1, // one device, one worker
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  // The project has no babel.config.js (the unit suite gets its transform from
  // the jest-expo preset), so pass the Expo preset to babel-jest inline. Without
  // it babel-jest cannot strip the TypeScript types or the ESM import syntax.
  transform: {
    '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
