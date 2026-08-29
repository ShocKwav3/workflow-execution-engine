import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const CHANGELOG_DIR = path.resolve(import.meta.dirname, "../db/changelog");

function loadFullSchemaSql(): string {
  const sqlFiles = readdirSync(CHANGELOG_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return sqlFiles.map((file) => readFileSync(path.join(CHANGELOG_DIR, file), "utf-8")).join("\n");
}

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  pool: Pool;
}

// Runs the changelog files as plain SQL — fast schema setup, doesn't verify Liquibase's own mechanics.
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer(
    `postgres:${process.env.POSTGRES_VERSION ?? "16"}`,
  ).start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });

  await pool.query(loadFullSchemaSql());

  return { container, pool };
}

export async function stopTestDatabase(db: TestDatabase): Promise<void> {
  await db.pool.end();
  await db.container.stop();
}
