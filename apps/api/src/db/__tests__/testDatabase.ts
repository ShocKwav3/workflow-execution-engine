import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const CHANGELOG_DIR = path.resolve(import.meta.dirname, "../../../db/changelog");

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

// Concatenates every changelog file (sorted by filename — relies on numeric-prefix
// naming discipline, e.g. 0001-, 0002-) and runs it as plain SQL. The Liquibase
// directives (--liquibase formatted sql, --changeset, --rollback) are plain SQL
// comments, harmless to execute directly. This does not verify Liquibase's own
// mechanics (checksums, changelock, apply ordering) — that's covered separately,
// by actually running Liquibase (done manually so far; plan §K calls out a
// dedicated broken-changeset test later). This only needs to get a real Postgres
// into "the current schema" state as fast as possible for repository tests, and
// stay correct as more changelog files are added without editing every test file.
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:16").start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });

  await pool.query(loadFullSchemaSql());

  return { container, pool };
}

export async function stopTestDatabase(db: TestDatabase): Promise<void> {
  await db.pool.end();
  await db.container.stop();
}
