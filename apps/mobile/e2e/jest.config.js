/**
 * Detox drives a real device, so these specs run in Detox's own environment —
 * separate from the jest-expo unit suite in screens/__tests__ and __tests__.
 * `npm test` excludes this directory; use `npm run e2e` to run it.
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 180000,
  maxWorkers: 1, // one device, one worker
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  transform: {
    '\\.[jt]sx?$': 'babel-jest',
  },
};
