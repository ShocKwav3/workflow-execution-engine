import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "@/server.js";
import type { TestDatabase } from "@workflow-engine/core/test/testDatabase.js";

export async function buildTestApp({ connection }: TestDatabase) {
  // Overridable — LOG_LEVEL=info pnpm test brings the logs back for a failing test.
  process.env.LOG_LEVEL ??= "silent";
  process.env.PGHOST = connection.host;
  process.env.PGPORT = String(connection.port);
  process.env.PGDATABASE = connection.database;
  process.env.PGUSER = connection.user;
  const passwordFile = join(mkdtempSync(join(tmpdir(), "pg-password-")), "password");

  writeFileSync(passwordFile, connection.password);
  process.env.PGPASSWORD_FILE = passwordFile;
  // Many workers now share one Postgres instance — keep each app pool small.
  process.env.PG_POOL_MAX ??= "3";

  return buildServer();
}
