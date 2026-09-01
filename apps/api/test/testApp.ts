import { buildServer } from "@/server.js";
import type { TestDatabase } from "@workflow-engine/core/test/testDatabase.js";

export async function buildTestApp({ container }: TestDatabase) {
  // Overridable — LOG_LEVEL=info pnpm test brings the logs back for a failing test.
  process.env.LOG_LEVEL ??= "silent";
  process.env.PGHOST = container.getHost();
  process.env.PGPORT = String(container.getPort());
  process.env.PGDATABASE = container.getDatabase();
  process.env.PGUSER = container.getUsername();
  process.env.PGPASSWORD = container.getPassword();

  return buildServer();
}
