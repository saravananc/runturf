# RunTurf API image.
#
# Build from the REPO ROOT so the monorepo workspace graph (packages/shared) is
# in the build context:
#   docker build -f apps/api/Dockerfile -t runturf-api .
#
# The app runs its TypeScript directly with tsx (no compile step), which also
# resolves packages/shared's TS source — matching how it runs in development.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Manifests first for layer caching. All workspace package.json files must be
# present so npm can resolve the workspace graph, even though we install only
# the API + shared workspaces below.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Production dependencies for the API and shared workspaces only (skips the web
# workspace's deps and all devDependencies). tsx is a runtime dependency.
RUN npm ci --omit=dev \
    --workspace @runturf/api \
    --workspace @runturf/shared \
    --include-workspace-root

# Application source for the two workspaces we actually run. .dockerignore keeps
# node_modules, dist, and (critically) any .env files out of the image.
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 4000
USER node

# Liveness: hit /health with Node's built-in fetch (no curl in the slim image).
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "apps/api"]
