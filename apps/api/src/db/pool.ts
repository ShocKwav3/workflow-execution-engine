import { Pool } from "pg";
import type { FastifyBaseLogger } from "fastify";
import type { PgPoolConfig } from "./config.js";

export function createPgPool(config: PgPoolConfig, logger: FastifyBaseLogger): Pool {
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
    logger.error({ err }, "unexpected error on idle PostgreSQL client");
  });

  return pool;
}

export async function closePgPool(pool: Pool): Promise<void> {
  await pool.end();
}
