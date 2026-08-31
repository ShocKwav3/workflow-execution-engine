FROM node:26-slim AS base

RUN npm install -g pnpm@11

WORKDIR /app

FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
RUN pnpm build

FROM base AS dev

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api

CMD ["pnpm", "dev"]

FROM base AS runtime

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/api/src/index.js"]
