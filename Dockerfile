FROM node:26

WORKDIR /app

RUN npm install -g pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
RUN pnpm build

CMD ["node", "dist/api/src/index.js"]
