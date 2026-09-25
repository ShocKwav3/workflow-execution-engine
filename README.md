# Workflow Execution Engine

A backend-only distributed workflow execution engine: define workflows as a sequence of nodes, version and publish them, then run and track executions. Built around PostgreSQL, with asynchronous work dispatch, Kafka, scheduling, Saga orchestration with retries/compensation, and horizontal scaling planned as the system grows.

## Status

Current API surface: workflow definitions, versions (draft → published lifecycle), nodes, executions, and execution history — backed by PostgreSQL, exposed over a Fastify + Zod HTTP API with OpenAPI generation and Spectral linting. Creating an execution persists it and returns immediately; nothing dispatches the work yet, so executions stay `PENDING`. Asynchronous work dispatch, scheduling, and Saga orchestration are not yet implemented.

## Stack

- Node.js (`^26`) + Fastify, TypeScript (ESM, `nodenext`)
- PostgreSQL, raw `pg` (no ORM), Liquibase for migrations
- Zod for runtime validation + OpenAPI generation (`fastify-type-provider-zod`)
- pnpm workspace (`apps/*`, `packages/*`), Vitest (+ Testcontainers for real Postgres in integration tests), ESLint/Prettier
- Docker Compose for local infrastructure

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, runs Liquibase migrations, and starts the API on `http://localhost:${PORT}` (default `3000`) with hot reloading from bind-mounted source.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Restarting only the API container (`docker compose restart api`) should not lose any data — state lives exclusively in the named `postgres_data` volume. `docker compose down -v` wipes that volume; plain `down`/`up` does not.

## Exploring the API

- **Bruno collection**: `apps/api/bruno/` — a full request set (`v1/`) covering the create → publish → execute → inspect flow, with docs per request and auto-captured IDs between requests. See `apps/api/bruno/README.md`.
- **OpenAPI spec**: generated at `apps/api/spec/v1/openapi.yaml` (run `pnpm generate:openapi`); interactive docs served at `/api/v1/docs` while the app is running.

## Development

```bash
pnpm install
pnpm build                 # builds every package, in dependency order (packages/core, then apps/api)
pnpm dev                   # workspace-wide watch build (TypeScript project references); compiles on any change
                           # (containers don't use this — each runs its own app's dev script)
pnpm test                  # vitest, full suite, spins up Testcontainers PostgreSQL
pnpm lint                  # eslint, whole workspace
pnpm generate:openapi
pnpm lint:spec             # spectral, lints the generated OpenAPI doc
pnpm clean:bundles         # removes every package's compiled output
pnpm clean:modules         # removes every node_modules in the workspace
```

Each package can also be tested independently, without spinning up infrastructure the package you're working on doesn't need:

```bash
pnpm --filter @workflow-engine/core test:unit          # no containers
pnpm --filter @workflow-engine/core test:integration    # Postgres, scoped to packages/core
pnpm --filter @workflow-engine/api test:unit            # no containers
pnpm --filter @workflow-engine/api test:integration     # Postgres, scoped to apps/api
```

Test files are named `*.unit.test.ts` or `*.integration.test.ts` — the suffix determines which of the above picks them up.

Each package has its own `tsconfig.json` (default, includes tests — what your editor should pick up) and `tsconfig.build.json` (extends it, excludes tests — what `pnpm build` actually compiles with), both extending the shared `tsconfig.base.json` at the repo root.

## Layout

```text
packages/core/    @workflow-engine/core — shared library, no entrypoint of its own
  db/             Liquibase changelog (shared schema, not API-specific)
  src/            DI container, error types, database pool + readers/writers, services, logging, config
  test/           shared test harness/fixtures (used across packages, excluded from the build)

apps/api/         @workflow-engine/api — the HTTP process
  bruno/          HTTP client collection
  spec/           generated OpenAPI documents (per API version)
  src/            routes, Fastify app/server setup, composition root

docker-compose.yml
Dockerfile        multi-stage: deps / builder / per-app dev (hot reload) / per-app runtime (lean, prod)
tsconfig.base.json
pnpm-workspace.yaml
```
