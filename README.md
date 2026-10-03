# Workflow Execution Engine

A backend-only distributed workflow execution engine: define workflows as a sequence of nodes, version and publish them, then run and track executions. Built around PostgreSQL, with asynchronous work dispatch, Kafka, scheduling, Saga orchestration with retries/compensation, and horizontal scaling planned as the system grows.

## Status

Current API surface: workflow definitions, versions (draft → published lifecycle), nodes, executions, and execution history — backed by PostgreSQL, exposed over a Fastify + Zod HTTP API with OpenAPI generation and Spectral linting. Creating an execution persists it together with a transactional outbox row describing the work to dispatch, and returns immediately; a separate outbox relay process drains that outbox into a BullMQ job queue on Redis; nothing consumes the queue yet, so executions stay `CREATED`. Running the queued work, scheduling, and Saga orchestration are not yet implemented.

## Stack

- Node.js (`^26`) + Fastify, TypeScript (ESM, `nodenext`)
- PostgreSQL, raw `pg` (no ORM), Liquibase for migrations
- Zod for runtime validation + OpenAPI generation (`fastify-type-provider-zod`)
- pnpm workspace (`apps/*`, `packages/*`), Vitest (+ Testcontainers for real Postgres in integration tests), ESLint/Prettier
- BullMQ on Redis (AOF persistence, `noeviction`) as the job queue; Redis is configured by `infra/redis/redis.conf`
- Docker Compose for local infrastructure

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL and Redis, runs Liquibase migrations, starts the outbox relay, and starts the API on `http://localhost:${PORT}` (default `3000`) with hot reloading from bind-mounted source.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Restarting only the API or relay container (`docker compose restart api`, `docker compose restart outbox-relay`) should not lose any data — state lives exclusively in the named `postgres_data` and `redis_data` volumes. `docker compose down -v` wipes them (and the `redisinsight_data` volume of the optional tools); plain `down`/`up` does not.

## Inspecting the queue

Two optional web UIs run under the `tools` Compose profile, so a plain `docker compose up` does not start them:

```bash
docker compose --profile tools up
```

- **Bull Board** at `http://localhost:3001` (login from `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`): the job queue as BullMQ sees it — waiting, active, completed and failed jobs with their data. Read-only.
- **Redis Insight** at `http://localhost:5540`: the raw Redis keys BullMQ stores. Accept its terms on first visit; the connection to the Compose Redis is preconfigured.

Both bind to `127.0.0.1` only.

## Exploring the API

- **Bruno collection**: `apps/api/bruno/` — a full request set (`v1/`) covering the create → publish → execute → inspect flow, with docs per request and auto-captured IDs between requests. See `apps/api/bruno/README.md`.
- **OpenAPI spec**: generated at `apps/api/spec/v1/openapi.yaml` (run `pnpm generate:openapi`); interactive docs served at `/api/v1/docs` while the app is running.

## Development

```bash
pnpm install
pnpm build                 # builds every package, in dependency order (packages/core, then the apps)
pnpm dev                   # workspace-wide watch build (TypeScript project references); compiles on any change
                           # (containers don't use this — each runs its own app's dev script)
pnpm test                  # vitest, full suite, spins up Testcontainers PostgreSQL and Redis
pnpm lint                  # eslint, whole workspace
pnpm generate:openapi
pnpm lint:spec             # spectral, lints the generated OpenAPI doc
pnpm clean:bundles         # removes every package's compiled output
pnpm clean:modules         # removes every node_modules in the workspace
```

Each package can also be tested independently, without spinning up infrastructure the package you're working on doesn't need:

```bash
pnpm --filter @workflow-engine/core test:unit          # no containers
pnpm --filter @workflow-engine/core test:integration    # Postgres + Redis, scoped to packages/core
pnpm --filter @workflow-engine/api test:unit            # no containers
pnpm --filter @workflow-engine/api test:integration     # Postgres, scoped to apps/api
pnpm --filter @workflow-engine/outbox-relay test:unit              # no containers
pnpm --filter @workflow-engine/outbox-relay test:integration       # Postgres + Redis
pnpm --filter @workflow-engine/executor test:unit                  # no containers
pnpm --filter @workflow-engine/executor test:integration           # Postgres + Redis
```

Test files are named `*.unit.test.ts` or `*.integration.test.ts` — the suffix determines which of the above picks them up.

Each package has its own `tsconfig.json` (default, includes tests — what your editor should pick up) and `tsconfig.build.json` (extends it, excludes tests — what `pnpm build` actually compiles with), both extending the shared `tsconfig.base.json` at the repo root.

## Layout

```text
packages/core/    @workflow-engine/core — shared library, no entrypoint of its own
  db/             Liquibase changelog (shared schema, not API-specific)
  src/            DI container, error types, database pool + readers/writers + outbox claimer, Redis
                  connection factory, services,
                  logging, config, shared validation schemas (schemas/) that persistence inputs and
                  API schemas derive from
  test/           shared test harness/fixtures (used across packages, excluded from the build)

apps/api/         @workflow-engine/api — the HTTP process
  bruno/          HTTP client collection
  spec/           generated OpenAPI documents (per API version)
  src/            routes, Fastify app/server setup, composition root

apps/outbox-relay/  @workflow-engine/outbox-relay — drains the transactional outbox into the job
                    queue
  src/            relay, poller, queue adapter, composition root, configuration

apps/executor/    @workflow-engine/executor — will consume workflow execution jobs and run their
                  nodes; currently only its configuration exists, no runnable process yet
  src/            configuration

infra/redis/      Redis server configuration mounted by Docker Compose

docker-compose.yml
Dockerfile        multi-stage: deps / builder / per-app dev (hot reload) / per-app runtime (lean, prod)
tsconfig.base.json
pnpm-workspace.yaml
```
