// Metro config for consuming the monorepo's shared package.
// apps/mobile is deliberately NOT an npm workspace (Expo prefers its own
// dependency tree), so Metro must be told to watch packages/shared and to
// resolve modules from both the app's and the repo root's node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(repoRoot, 'packages/shared')];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];
// Note: hierarchical lookup is intentionally left at Expo's default. The shared
// package has no runtime dependencies of its own, so it cannot introduce a
// duplicate React, and overriding the default trips `expo-doctor`.

// packages/shared is authored as ESM TypeScript, so its relative imports carry
// explicit ".js" extensions (required by Node's ESM resolver, which the API
// uses). Metro resolves specifiers literally and would look for a non-existent
// grid.js, so map ".js" back to the ".ts" source for that package only.
const sharedSrc = path.resolve(repoRoot, 'packages', 'shared');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  const fromShared = context.originModulePath?.startsWith(sharedSrc);
  if (fromShared && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, `${moduleName.slice(0, -3)}.ts`, platform);
    } catch {
      // Fall through to the literal specifier below.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
