# Workflow Execution Engine

A backend-only distributed workflow execution engine: define workflows as a sequence of nodes, version and publish them, then run and track executions. Built around PostgreSQL, with asynchronous work dispatch, Kafka, scheduling, Saga orchestration with retries/compensation, and horizontal scaling planned as the system grows.

## Status

Works today:

- Workflow definitions, versions (draft → published), nodes, executions and execution history, over a Fastify HTTP API with a generated OpenAPI document.
- Asynchronous execution: the API writes each execution with a transactional outbox row. The outbox relay moves the row into a BullMQ queue on Redis. The executor runs the nodes in order (`CREATED → RUNNING → COMPLETED`) and resumes from PostgreSQL after a crash.
- Health endpoints (`/health`, `/ready`) on all three processes.
- Container images for each process and for the migrations. Kubernetes manifests are in the deploy repository (see [Deployment](#deployment)).

Not built yet: scheduling, failure handling with retries and compensation (Saga), Kafka.

## Stack

- Node.js (`^26`), TypeScript (ESM, `nodenext`), Fastify
- PostgreSQL with raw `pg` (no ORM), Liquibase for migrations
- Zod for validation and OpenAPI generation (`fastify-type-provider-zod`)
- BullMQ on Redis for the job queue
- pnpm workspace, Vitest with Testcontainers, ESLint, Prettier
- Docker multi-stage images; Docker Compose for local development
- Kubernetes with Kustomize (minikube locally)
- k6 for load tests

## Running locally

Requirements: Docker with Docker Compose.

```bash
cp .env.example .env
docker compose up --build --watch
```

This starts PostgreSQL and Redis, runs the migrations, and starts the API, the outbox relay and the executor. A source change rebuilds and restarts the affected app.

| Service             | URL (default port)                       |
| ------------------- | ---------------------------------------- |
| API                 | `http://localhost:3000`                  |
| API docs            | `http://localhost:3000/api/v1/docs`      |
| Outbox relay health | `http://localhost:9001/health`, `/ready` |
| Executor health     | `http://localhost:9002/health`, `/ready` |

All ports bind to `127.0.0.1`. If a port is in use, change it in `.env`.

To stop, press `Ctrl+C` or run `docker compose stop`. The data stays in Docker volumes. `docker compose down -v` deletes it.

### Health endpoints

- `GET /health` (liveness) checks only the process. An outage of PostgreSQL or Redis does not make it fail. It fails if the relay finished no poll cycle for 60 s, or if the executor's BullMQ worker stopped.
- `GET /ready` (readiness) returns `200` only when the dependencies answer: PostgreSQL for the API, PostgreSQL and Redis for the workers. During a shutdown, it returns `503`.

```bash
docker compose stop redis      # /ready → 503 on both workers, /health stays 200
docker compose start redis     # /ready → 200 again within about a second
```

### Configuration

- **Redis** (`infra/redis/redis.conf`):
  - `maxmemory-policy noeviction`: BullMQ breaks when Redis evicts its keys, so writes fail at the memory limit instead.
  - AOF persistence (`appendonly yes`, `appendfsync everysec`): queued jobs survive a restart.
  - No password: Redis is reachable only on the Compose network and the host's loopback port.
- **PostgreSQL TLS** is off by default. To use TLS with server verification, set `PGSSLMODE=verify-full` and set `PGSSLROOTCERT` to the path of the CA certificate. The apps accept only `disable` and `verify-full`. They stop at startup on any other value, or on `PGSSLROOTCERT` without `verify-full`.

## Inspecting the queue

Two optional web UIs run under the `tools` Compose profile, so a plain `docker compose up` does not start them:

```bash
docker compose --profile tools up
```

- **Bull Board** at `http://localhost:${BULL_BOARD_PORT}` (default `3001`) (login from `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`): the job queue as BullMQ sees it — waiting, active, completed and failed jobs with their data. Read-only.
- **Redis Insight** at `http://localhost:${REDISINSIGHT_PORT}` (default `5540`): the raw Redis keys BullMQ stores. Accept its terms on first visit; the connection to the Compose Redis is preconfigured.

Both bind to `127.0.0.1` only.

## Exploring the API

- **Bruno collection**: `apps/api/bruno/` — a full request set (`v1/`) covering the create → publish → execute → inspect flow, with docs per request and auto-captured IDs between requests. See `apps/api/bruno/README.md`.
- **OpenAPI spec**: generated at `apps/api/spec/v1/openapi.yaml` (run `pnpm generate:openapi`); interactive docs served at `/api/v1/docs` while the app is running.

## Development

```bash
pnpm install
pnpm build                 # builds every package, in dependency order (packages/core, then the apps)
pnpm dev                   # host watch build (TypeScript project references); compiles on any change
                           # (containers don't use this — each runs nodemon with its app's nodemon.json)
pnpm test                  # vitest, unit + integration, spins up Testcontainers PostgreSQL and Redis
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

Test files are named `*.unit.test.ts`, `*.integration.test.ts` or `*.e2e.test.ts` — the suffix determines which of the above picks them up.

Each package has its own `tsconfig.json` (default, includes tests — what your editor should pick up) and `tsconfig.build.json` (extends it, excludes tests — what `pnpm build` actually compiles with), both extending the shared `tsconfig.base.json` at the repo root.

### Hot reload in Compose

Each app container runs `nodemon` (configured in the app's `nodemon.json`) under an init process. Only `src/` folders and `scripts/` are bind-mounted, and each container builds into its own `dist`.

- **Source change:** nodemon stops the app with `SIGTERM`, then `scripts/dev-launch.sh` builds `packages/core` and the app and starts Node.
- **Build error:** the error is printed, and the service waits for the next source change.
- **Crash:** `--exitcrash` makes the container exit, and `restart: on-failure` starts it again.
- **Configuration change** (`tsconfig*.json`, `nodemon.json`, `package.json`, `pnpm-lock.yaml`): `--watch` rebuilds and replaces the affected services. Without `--watch`, run `docker compose up --build`.

### Load test

`scripts/load-executions.js` creates one published workflow, then starts 5 executions per second and reads each one back. The test fails if more than 1% of the requests fail. It needs [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and, for the resource samples, `kubectl` with metrics-server.

```bash
pnpm test:load                                         # 3 minutes against http://127.0.0.1
LOAD_TEST_DURATION=10m LOAD_TEST_BASE_URL=http://localhost:3000 pnpm test:load
```

`pnpm test:load` runs `scripts/load-test.sh`. It samples `kubectl top pods` every `LOAD_TEST_INTERVAL` seconds (default `60`) in the `LOAD_TEST_NAMESPACE` namespace (default `workflow-engine`) while k6 runs. Then it writes the samples and the k6 summary to `LOAD_TEST_OUT` (default `load-test.log`).

### End-to-end smoke test

`e2e/smoke.e2e.test.ts` uses only the HTTP API. It creates and publishes a workflow with one node, starts an execution, and polls it until `COMPLETED` (30 s timeout). It does not start any service, so the system must already run. `pnpm test` does not include it.

```bash
docker compose up -d
pnpm test:e2e                                          # against http://localhost:3000
E2E_BASE_URL=http://127.0.0.1 pnpm test:e2e            # against minikube, through minikube tunnel
```

If the test times out, the failure message gives the execution ID and the correlation ID. Search the API, relay and executor logs for the correlation ID.

### CI

Every pull request and push to `main` runs `.github/workflows/ci.yml`. Each concern is a separate job:

- `build`, `lint`, `test`: the same commands as above. `test` uses the build output of `build`.
- `openapi`: regenerates the spec, fails if the committed spec differs, then lints it.
- `image`: builds the four runtime images for `linux/arm64` with `docker/docker-bake.hcl`. Nothing is pushed.
- `image-scan`: scans the four images for known vulnerabilities with a fix available, `HIGH` and `CRITICAL` (Trivy).
- `config-scan`: a static security scan of the Dockerfiles and the workflows (Checkov).
- `ci-passed`: fails unless every job above succeeded. It is the only required check on `main`. It posts a table of the job results on the pull request, with the findings of both scans in collapsed sections.

The two scans only report: a finding does not fail the job or block the merge. Read the security report in the pull request comment.

## Deployment

The Kubernetes manifests are in [workflow-execution-engine-deploy](https://github.com/ShocKwav3/workflow-execution-engine-deploy). Its `k8s/deploy-local.sh` builds the images from a clone of this repository and deploys them to minikube; `k8s/deploy-local.md` explains the setup and each step.

## Layout

```text
packages/core/    @workflow-engine/core — shared library, no entrypoint of its own
  db/             Liquibase changelog (shared schema, not API-specific) and the migration image:
                  target dev (Compose mounts the changelog), target runtime (changelog copied in)
  src/            DI container, error types, database pool + readers/writers + outbox claimer, Redis
                  connection factory, health checks and the health listener for the workers,
                  services,
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

apps/executor/    @workflow-engine/executor — consumes workflow execution jobs and runs each
                  execution's nodes in order, resuming from Postgres after a crash
  src/            queue consumer, execution runner, simulated node work, composition root,
                  configuration

e2e/              end-to-end smoke test against a running system, over HTTP only

infra/redis/      Redis server configuration mounted by Docker Compose; the Kubernetes manifests keep
                  an identical copy (see Deployment)

scripts/          Compose dev launcher (dev-launch.sh), the k6 load test (load-executions.js) and its
                  runner with resource samples (load-test.sh)

docker/
  app.Dockerfile      multi-stage: deps / builder / per-app dev (hot reload) / per-app runtime (lean,
                      prod, no pnpm, runs as the non-root node user, UID 1000)
  migrate.Dockerfile  Liquibase migration image; the runtime target contains the changelog
  docker-bake.hcl     the four arm64 runtime images (`docker buildx bake -f docker/docker-bake.hcl`)

compose.yaml
tsconfig.base.json
pnpm-workspace.yaml
```
