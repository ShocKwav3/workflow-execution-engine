import { Pool } from "pg";
import { createToken } from "../di/token.js";
import type { PgPoolConfig } from "./config.js";

export const pgPoolToken = createToken<Pool>("pgPool");

export function createPgPool(config: PgPoolConfig): Pool {
  return new Pool({
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
}

export async function closePgPool(pool: Pool): Promise<void> {
  await pool.end();
}

// Not called automatically on import — the app-shell composition root (Task 3)
// decides when to wire this up, so importing this module has no process-wide side effects.
export function registerGracefulShutdown(pool: Pool): void {
  const shutdown = () => {
    void closePgPool(pool);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
