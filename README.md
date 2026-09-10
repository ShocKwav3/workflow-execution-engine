# Workflow Execution Engine

A backend-only distributed workflow execution engine: define workflows as a sequence of nodes, version and publish them, then run and track executions. Built around PostgreSQL and RabbitMQ, with Kafka, scheduling, Saga orchestration with retries/compensation, and horizontal scaling planned as the system grows.

## Status

Current API surface: workflow definitions, versions (draft → published lifecycle), nodes, executions, and execution history — backed by PostgreSQL, exposed over a Fastify + Zod HTTP API with OpenAPI generation and Spectral linting. Creating an execution also writes a `StartWorkflowExecution` command to a transactional outbox table, in the same database transaction as the execution itself. A separate outbox publisher process drains that table and publishes each command to RabbitMQ on a confirm channel. Nothing consumes those commands yet, so they accumulate in the queue and no execution is processed. Scheduling and Saga orchestration are not yet implemented.

## Stack

- Node.js (`^26`) + Fastify, TypeScript (ESM, `nodenext`)
- PostgreSQL, raw `pg` (no ORM), Liquibase for migrations
- RabbitMQ, `amqplib`
- Zod for runtime validation + OpenAPI generation (`fastify-type-provider-zod`)
- pnpm workspace (`apps/*`, `packages/*`), Vitest (+ Testcontainers for real Postgres/RabbitMQ in integration tests), ESLint/Prettier
- Docker Compose for local infrastructure

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, runs Liquibase migrations, starts RabbitMQ, and starts two processes (hot-reloading, bind-mounted source): the API on `http://localhost:${PORT}` (default `3000`), and the outbox publisher. The API never opens an AMQP connection — it records outbound commands in the outbox table instead, so creating an execution succeeds even while RabbitMQ is down. The publisher polls that table, claims rows with `FOR UPDATE SKIP LOCKED`, and publishes each command with a publisher confirm before marking the row published; it starts and keeps polling even when the broker is unreachable, and reconnects on its own. Nothing consumes the queue yet.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

RabbitMQ's management UI is at `http://localhost:15672` (credentials from `.env`).

Restarting only the API container (`docker compose restart api`) should not lose any data — state lives exclusively in named volumes (`postgres_data`, `rabbitmq_data`). `docker compose down -v` wipes those volumes; plain `down`/`up` does not.

## Exploring the API

- **Bruno collection**: `apps/api/bruno/` — a full request set (`v1/`) covering the create → publish → execute → inspect flow, with docs per request and auto-captured IDs between requests. See `apps/api/bruno/README.md`.
- **OpenAPI spec**: generated at `apps/api/spec/v1/openapi.yaml` (run `pnpm generate:openapi`); interactive docs served at `/api/v1/docs` while the app is running.

## Development

```bash
pnpm install
pnpm build                 # builds every package, in dependency order (packages/core, then the apps)
pnpm dev                   # workspace-wide watch build (TypeScript project references); compiles on any change
                           # (containers don't use this — each runs its own app's dev script)
pnpm test                  # vitest, full suite, spins up Testcontainers PostgreSQL + RabbitMQ
pnpm lint                  # eslint, whole workspace
pnpm generate:openapi
pnpm lint:spec             # spectral, lints the generated OpenAPI doc
pnpm clean:bundles         # removes every package's compiled output
pnpm clean:modules         # removes every node_modules in the workspace
```

Each package can also be tested independently, without spinning up infrastructure the package you're working on doesn't need:

```bash
pnpm --filter @workflow-engine/core test:unit          # no containers
pnpm --filter @workflow-engine/core test:integration    # Postgres + RabbitMQ, scoped to packages/core
pnpm --filter @workflow-engine/api test:unit            # no containers
pnpm --filter @workflow-engine/api test:integration     # Postgres only, scoped to apps/api
pnpm --filter @workflow-engine/outbox-publisher test:unit          # no containers
pnpm --filter @workflow-engine/outbox-publisher test:integration   # Postgres + RabbitMQ
```

Test files are named `*.unit.test.ts` or `*.integration.test.ts` — the suffix determines which of the above picks them up.

Each package has its own `tsconfig.json` (default, includes tests — what your editor should pick up) and `tsconfig.build.json` (extends it, excludes tests — what `pnpm build` actually compiles with), both extending the shared `tsconfig.base.json` at the repo root.

## Layout

```text
packages/core/    @workflow-engine/core — shared library, no entrypoint of its own
  db/             Liquibase changelog (shared schema, not API-specific)
  src/            DI container, error types, database pool + readers/writers, transactional outbox, services, AMQP connection/topology/message contracts, logging, config
  test/           shared test harness/fixtures (used across packages, excluded from the build)

apps/api/         @workflow-engine/api — the HTTP process
  bruno/          HTTP client collection
  spec/           generated OpenAPI documents (per API version)
  src/            routes, Fastify app/server setup, composition root

apps/outboxPublisher/  @workflow-engine/outbox-publisher — drains the outbox table to RabbitMQ
  src/            poll loop, outbox relay, composition root, entrypoint

docker-compose.yml
Dockerfile        multi-stage: deps / builder / per-app dev (hot reload) / per-app runtime (lean, prod)
tsconfig.base.json
pnpm-workspace.yaml
```
