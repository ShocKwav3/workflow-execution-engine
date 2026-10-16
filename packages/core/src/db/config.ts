import { optionalIntEnv, requireEnv } from "@/config/env.js";

export type PgSslConfig = { mode: "disable" } | { mode: "verify-full"; rootCertPath: string };

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
  ssl: PgSslConfig;
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
    ssl: loadPgSslConfig(),
  };
}

// libpq names, but only the two modes that map to a pg ssl option: pg itself ignores PGSSLROOTCERT.
function loadPgSslConfig(): PgSslConfig {
  const mode = process.env.PGSSLMODE?.trim() || "disable";

  if (mode === "verify-full") {
    return {
      mode,
      rootCertPath: requireEnv("PGSSLROOTCERT", "required when PGSSLMODE=verify-full"),
    };
  }

  if (mode !== "disable") {
    throw new Error(
      `Environment variable PGSSLMODE must be "disable" or "verify-full", got: ${mode}`,
    );
  }

  if (process.env.PGSSLROOTCERT) {
    throw new Error("PGSSLROOTCERT is set but PGSSLMODE is not verify-full");
  }

  return { mode };
}
