import { Pool } from "pg";
import { createToken } from "../di/token.js";
import type { PgPoolConfig } from "./config.js";

export const pgPoolToken = createToken<Pool>("pgPool");

export function createPgPool(config: PgPoolConfig): Pool {
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
  });

  pool.on("error", (err) => {
    console.error(`Unexpected error on idle PostgreSQL client: ${err.message}`);
  });

  return pool;
}

export async function closePgPool(pool: Pool): Promise<void> {
  await pool.end();
}
