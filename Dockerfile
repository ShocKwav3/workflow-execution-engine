FROM node:26-slim AS base

RUN npm install -g pnpm@11

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/outboxPublisher/package.json apps/outboxPublisher/
RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY tsconfig.json ./
COPY packages/core ./packages/core
COPY apps/api ./apps/api
COPY apps/outboxPublisher ./apps/outboxPublisher
RUN pnpm -r build
RUN pnpm --filter @workflow-engine/api deploy --prod --legacy /app/deploy/api
RUN pnpm --filter @workflow-engine/outbox-publisher deploy --prod --legacy /app/deploy/outboxPublisher

# Each dev stage carries only the packages its process needs; an app's own tsconfig.build.json
# references core, so `tsc -b` still builds core first without the root solution file.
FROM deps AS api-dev

COPY packages/core ./packages/core
COPY apps/api ./apps/api

CMD ["sh", "-c", "pnpm --filter @workflow-engine/core run dev & exec pnpm --filter @workflow-engine/api run dev"]

FROM deps AS outbox-publisher-dev

COPY packages/core ./packages/core
COPY apps/outboxPublisher ./apps/outboxPublisher

CMD ["sh", "-c", "pnpm --filter @workflow-engine/core run dev & exec pnpm --filter @workflow-engine/outbox-publisher run dev"]

FROM base AS api-runtime

COPY --from=builder /app/deploy/api ./

CMD ["node", "dist/src/index.js"]

FROM base AS outbox-publisher-runtime

COPY --from=builder /app/deploy/outboxPublisher ./

CMD ["node", "dist/src/index.js"]
