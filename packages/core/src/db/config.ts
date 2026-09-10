import { optionalIntEnv, requireEnv } from "@/config/env.js";

export interface PgPoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxLifetimeSeconds: number;
}

export const PG_POOL_DEFAULTS = {
  port: 5432,
  max: 10,
  min: 2,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  maxLifetimeSeconds: 1800,
} as const;

export function loadPgPoolConfig(): PgPoolConfig {
  return {
    host: requireEnv("PGHOST"),
    port: optionalIntEnv("PGPORT", PG_POOL_DEFAULTS.port),
    database: requireEnv("PGDATABASE"),
    user: requireEnv("PGUSER"),
    password: requireEnv("PGPASSWORD"),
    max: optionalIntEnv("PG_POOL_MAX", PG_POOL_DEFAULTS.max),
    min: optionalIntEnv("PG_POOL_MIN", PG_POOL_DEFAULTS.min),
    idleTimeoutMillis: optionalIntEnv(
      "PG_POOL_IDLE_TIMEOUT_MS",
      PG_POOL_DEFAULTS.idleTimeoutMillis,
    ),
    connectionTimeoutMillis: optionalIntEnv(
      "PG_POOL_CONNECTION_TIMEOUT_MS",
      PG_POOL_DEFAULTS.connectionTimeoutMillis,
    ),
    maxLifetimeSeconds: optionalIntEnv(
      "PG_POOL_MAX_LIFETIME_SECONDS",
      PG_POOL_DEFAULTS.maxLifetimeSeconds,
    ),
  };
}
