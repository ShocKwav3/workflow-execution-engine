import { readFileSync } from "node:fs";
import { Pool } from "pg";
import type { Logger } from "../logging/types.js";
import type { PgPoolConfig } from "./config.js";

export function createPgPool(config: PgPoolConfig, logger: Logger): Pool {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max,
    min: config.min,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    maxLifetimeSeconds: config.maxLifetimeSeconds,
    // Always explicit: when ssl is undefined, pg reads PGSSLMODE on its own.
    ssl:
      config.ssl.mode === "verify-full"
        ? { ca: readFileSync(config.ssl.rootCertPath, "utf8"), rejectUnauthorized: true }
        : false,
  });

  pool.on("error", (err) => {
    logger.error({ err }, "unexpected error on idle PostgreSQL client");
  });

  return pool;
}

export async function closePgPool(pool: Pool): Promise<void> {
  await pool.end();
}
