import setupPostgres from "./setupTestcontainersPostgres.js";

// Used only by the repo-root vitest.config.ts (the full/CI run) — boots the container once,
// shared across every project in that single invocation. Package-scoped runs (pnpm --filter
// <pkg> test) use setupTestcontainersPostgres.ts directly instead.
export default async function setup() {
  return setupPostgres();
}
