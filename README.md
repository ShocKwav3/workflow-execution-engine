# Workflow Execution Engine

A backend-only distributed workflow execution engine: define workflows as a sequence of nodes, version and publish them, then run and track executions. Built around PostgreSQL, with messaging (RabbitMQ/Kafka), transactional outbox, scheduling, Saga orchestration with retries/compensation, and horizontal scaling planned as the system grows.

## Status

Current API surface: workflow definitions, versions (draft → published lifecycle), nodes, executions, and execution history — backed by PostgreSQL, exposed over a Fastify + Zod HTTP API with OpenAPI generation and Spectral linting. Asynchronous execution (messaging, scheduling, Saga orchestration) is not yet implemented — executions are currently created and persisted but not processed.

## Stack

- Node.js (`^26`) + Fastify, TypeScript (ESM, `nodenext`)
- PostgreSQL, raw `pg` (no ORM), Liquibase for migrations
- Zod for runtime validation + OpenAPI generation (`fastify-type-provider-zod`)
- pnpm workspace (`apps/*`, `packages/*`), Vitest (+ Testcontainers for real-Postgres integration tests), ESLint/Prettier
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
- **OpenAPI spec**: generated at `apps/api/spec/v1/openapi.yaml` (run `pnpm generate:openapi`); interactive docs served at `/api/v1/docs` while the app is running.

## Development

```bash
pnpm install
pnpm build                 # builds every package, in dependency order (packages/core, then apps/api)
pnpm dev                   # workspace-wide watch build (TypeScript project references); compiles on any change
pnpm test                  # vitest, spins up Testcontainers PostgreSQL
pnpm lint                  # eslint, whole workspace
pnpm generate:openapi
pnpm lint:spec             # spectral, lints the generated OpenAPI doc
pnpm clean:bundles         # removes every package's compiled output
pnpm clean:modules         # removes every node_modules in the workspace
```

Each package has its own `tsconfig.json` (default, includes tests — what your editor should pick up) and `tsconfig.build.json` (extends it, excludes tests — what `pnpm build` actually compiles with), both extending the shared `tsconfig.base.json` at the repo root.

## Layout

```text
packages/core/    @workflow-engine/core — shared library, no entrypoint of its own
  src/            DI container, error types, database pool + repositories, logging, config
  test/           shared test harness/fixtures (used by both packages, excluded from the build)

apps/api/         @workflow-engine/api — the HTTP process
  db/             Liquibase changelog
  bruno/          HTTP client collection
  spec/           generated OpenAPI documents (per API version)
  src/            routes, Fastify app/server setup, composition root

docker-compose.yml
Dockerfile        multi-stage: builder / dev (hot reload) / runtime (lean, prod)
tsconfig.base.json
pnpm-workspace.yaml
```
