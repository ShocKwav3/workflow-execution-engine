import setupPostgres from "./setupTestcontainersPostgres.js";
import setupRedis from "./setupTestcontainersRedis.js";

// Root vitest.config.ts only; package-scoped runs list the setupTestcontainers*.ts files they need.
export default async function setup() {
  const teardowns = await Promise.all([setupPostgres(), setupRedis()]);

  return async () => {
    await Promise.all(teardowns.map((teardown) => teardown()));
  };
}
