FROM node:26-slim AS base

RUN npm install -g pnpm@11

WORKDIR /app

FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

COPY packages/core ./packages/core
COPY apps/api ./apps/api
RUN pnpm -r build
RUN pnpm --filter @workflow-engine/api deploy --prod --legacy /app/deploy/api

FROM base AS dev

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

COPY packages/core ./packages/core
COPY apps/api ./apps/api

# core has no watcher of its own yet — api's tsc-watch only rebuilds api. A one-time
# build gives api's dev server something to import; rebuild manually after core edits.
RUN pnpm --filter @workflow-engine/core build

CMD ["pnpm", "--filter", "@workflow-engine/api", "dev"]

FROM base AS runtime

COPY --from=builder /app/deploy/api ./

CMD ["node", "dist/src/index.js"]
