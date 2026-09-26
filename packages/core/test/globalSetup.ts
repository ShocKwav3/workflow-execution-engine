import setupPostgres from "./setupTestcontainersPostgres.js";
import setupRedis from "./setupTestcontainersRedis.js";

// Used only by the repo-root vitest.config.ts (the full/CI run) — boots each container once,
// shared across every project in that single invocation. Package-scoped runs (pnpm --filter
// <pkg> test) use the setupTestcontainers*.ts files they need directly instead.
export default async function setup() {
  const teardowns = await Promise.all([setupPostgres(), setupRedis()]);

  return async () => {
    await Promise.all(teardowns.map((teardown) => teardown()));
  };
}
