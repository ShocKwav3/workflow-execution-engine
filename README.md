# Workflow Execution Engine

A backend-only distributed workflow execution engine: define workflows as a sequence of nodes, version and publish them, then run and track executions. Built around PostgreSQL, with messaging (RabbitMQ/Kafka), transactional outbox, scheduling, Saga orchestration with retries/compensation, and horizontal scaling planned as the system grows.

## Status

Current API surface: workflow definitions, versions (draft → published lifecycle), nodes, executions, and execution history — backed by PostgreSQL, exposed over a Fastify + Zod HTTP API with OpenAPI generation and Spectral linting. Asynchronous execution (messaging, scheduling, Saga orchestration) is not yet implemented — executions are currently created and persisted but not processed.

## Stack

- Node.js (`^26`) + Fastify, TypeScript (ESM, `nodenext`)
- PostgreSQL, raw `pg` (no ORM), Liquibase for migrations
- Zod for runtime validation + OpenAPI generation (`fastify-type-provider-zod`)
- pnpm, Vitest (+ Testcontainers for real-Postgres integration tests), ESLint/Prettier
- Docker Compose for local infrastructure

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, runs Liquibase migrations, and starts the API (hot-reloading, bind-mounted source) on `http://localhost:${PORT}` (default `3000`).

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Restarting only the API container (`docker compose restart api`) should not lose any data — state lives exclusively in PostgreSQL's named volume (`postgres_data`). `docker compose down -v` wipes that volume; plain `down`/`up` does not.

## Exploring the API

- **Bruno collection**: `apps/api/bruno/` — a full request set (`v1/`) covering the create → publish → execute → inspect flow, with docs per request and auto-captured IDs between requests. See `apps/api/bruno/README.md`.
- **OpenAPI spec**: generated at `apps/api/spec/v1/openapi.json` (run `pnpm generate:openapi`); interactive docs served at `/api/v1/docs` while the app is running.

## Development

```bash
pnpm install
pnpm build           # tsc -p tsconfig.build.json + tsc-alias
pnpm dev             # hot-reload dev server (expects PG* env vars, e.g. via docker compose)
pnpm test            # vitest, spins up Testcontainers PostgreSQL
pnpm lint            # eslint
pnpm generate:openapi
pnpm lint:spec       # spectral, lints the generated OpenAPI doc
```

Two `tsconfig`s exist by design: `tsconfig.json` (default, includes tests — what your editor should pick up) and `tsconfig.build.json` (extends it, excludes tests — what `pnpm build`/`pnpm dev` actually compile with).

## Layout

```text
apps/api/
  db/           Liquibase changelog
  bruno/        HTTP client collection
  spec/         generated OpenAPI documents (per API version)
  src/          application source
  test/         shared test harness/fixtures (excluded from the build)
docker-compose.yml
Dockerfile      multi-stage: builder / dev (hot reload) / runtime (lean, prod)
tsconfig.json, tsconfig.build.json
```
