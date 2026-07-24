// Mirrors the resolveRequest shim in metro.config.js so tests resolve modules
// the same way the bundler does.
//
// packages/shared is ESM TypeScript, so its relative imports carry explicit
// ".js" extensions (required by Node's ESM resolver, which the API uses).
// Jest resolves specifiers literally and would look for a non-existent grid.js.
// Scoping on the importer's directory keeps the rewrite off every other package.
const path = require('path');

const sharedRoot = path.resolve(__dirname, '../../packages/shared');

module.exports = (request, options) => {
  const fromShared = options.basedir?.startsWith(sharedRoot);
  if (fromShared && request.startsWith('.') && request.endsWith('.js')) {
    try {
      return options.defaultResolver(`${request.slice(0, -3)}.ts`, options);
    } catch {
      // Fall through to the literal specifier below.
    }
  }
  return options.defaultResolver(request, options);
};
