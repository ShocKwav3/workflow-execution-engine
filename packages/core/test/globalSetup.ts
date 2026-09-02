import setupPostgres from "./setupTestcontainersPostgres.js";
import setupRabbitmq from "./setupTestcontainersRabbitmq.js";

// Used only by the repo-root vitest.config.ts (the full/CI run) — boots both containers once,
// shared across every project in that single invocation. Package-scoped runs (pnpm --filter
// <pkg> test) use setupTestcontainersPostgres.ts / setupTestcontainersRabbitmq.ts directly
// instead, so a focused run never pays for infrastructure it doesn't need.
export default async function setup() {
  const [teardownPostgres, teardownRabbitmq] = await Promise.all([
    setupPostgres(),
    setupRabbitmq(),
  ]);

  return async () => {
    await Promise.all([teardownPostgres(), teardownRabbitmq()]);
  };
}
