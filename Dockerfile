FROM node:26-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11

# Inherited by every stage: tini is PID 1, forwards signals and reaps orphaned processes.
ENTRYPOINT ["tini", "--"]

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/outbox-relay/package.json apps/outbox-relay/
COPY apps/executor/package.json apps/executor/
RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY tsconfig.json ./
COPY packages/core ./packages/core
COPY apps/api ./apps/api
COPY apps/outbox-relay ./apps/outbox-relay
COPY apps/executor ./apps/executor
RUN pnpm -r build
RUN pnpm --filter @workflow-engine/api deploy --prod --legacy /app/deploy/api
RUN pnpm --filter @workflow-engine/outbox-relay deploy --prod --legacy /app/deploy/outbox-relay
RUN pnpm --filter @workflow-engine/executor deploy --prod --legacy /app/deploy/executor

# Each dev stage carries only the packages its process needs; an app's own tsconfig.build.json
# references core, so `tsc -b` still builds core first without the root solution file.
FROM deps AS api-dev

COPY scripts ./scripts
COPY packages/core ./packages/core
COPY apps/api ./apps/api

ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/apps/api

CMD ["nodemon", "--exitcrash"]

FROM base AS api-runtime

COPY --from=builder /app/deploy/api ./

CMD ["node", "dist/src/index.js"]

FROM deps AS executor-dev

COPY scripts ./scripts
COPY packages/core ./packages/core
COPY apps/executor ./apps/executor

ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/apps/executor

CMD ["nodemon", "--exitcrash"]

FROM base AS executor-runtime

COPY --from=builder /app/deploy/executor ./

CMD ["node", "dist/src/index.js"]

FROM deps AS outbox-relay-dev

COPY scripts ./scripts
COPY packages/core ./packages/core
COPY apps/outbox-relay ./apps/outbox-relay

ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/apps/outbox-relay

CMD ["nodemon", "--exitcrash"]

FROM base AS outbox-relay-runtime

COPY --from=builder /app/deploy/outbox-relay ./

CMD ["node", "dist/src/index.js"]
