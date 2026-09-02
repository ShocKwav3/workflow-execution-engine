import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const CHANGELOG_DIR = path.resolve(process.cwd(), "apps/api/db/changelog");

function loadFullSchemaSql(): string {
  const sqlFiles = readdirSync(CHANGELOG_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return sqlFiles.map((file) => readFileSync(path.join(CHANGELOG_DIR, file), "utf-8")).join("\n");
}

export interface TestDatabaseConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface TestDatabase {
  connection: TestDatabaseConnection;
  pool: Pool;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name} — is globalSetup wired up?`);
  }

  return value;
}

function sharedContainerCredentials() {
  return {
    host: requireEnv("TEST_PG_HOST"),
    port: Number(requireEnv("TEST_PG_PORT")),
    user: requireEnv("TEST_PG_USER"),
    password: requireEnv("TEST_PG_PASSWORD"),
  };
}

function workerDatabaseName(): string {
  const poolId = process.env.VITEST_POOL_ID ?? "0";

  if (!/^\d+$/.test(poolId)) {
    throw new Error(`Unexpected VITEST_POOL_ID value: ${poolId}`);
  }

  return `test_worker_${poolId}`;
}

// Reuses one database per Vitest worker across every file that worker executes, instead of a
// fresh container per file. See globalSetup.ts for the shared container itself.
export async function startTestDatabase(): Promise<TestDatabase> {
  const credentials = sharedContainerCredentials();
  const adminPool = new Pool({
    ...credentials,
    database: requireEnv("TEST_PG_ADMIN_DATABASE"),
    max: 2,
  });

  adminPool.on("error", () => {});

  const database = workerDatabaseName();
  const existing = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    database,
  ]);
  const isNewDatabase = existing.rowCount === 0;

  if (isNewDatabase) {
    await adminPool.query(`CREATE DATABASE ${database}`);
  }

  await adminPool.end();

  const connection: TestDatabaseConnection = { ...credentials, database };
  const pool = new Pool({ ...connection, max: 3 });

  pool.on("error", () => {});

  if (isNewDatabase) {
    await pool.query(loadFullSchemaSql());
  }

  return { connection, pool };
}

export async function stopTestDatabase(db: TestDatabase): Promise<void> {
  await db.pool.end();
}
