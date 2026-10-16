import { positiveIntEnv } from "./env.js";

export interface HealthConfig {
  port: number;
  checkIntervalMs: number;
  checkTimeoutMs: number;
  resultExpiryMs: number;
}

// The expiry tolerates one lost check: 2 × interval + timeout.
export const HEALTH_DEFAULTS = {
  port: 8081,
  checkIntervalMs: 5_000,
  checkTimeoutMs: 2_000,
  resultExpiryMs: 12_000,
} as const;

export function loadHealthConfig(): HealthConfig {
  return {
    port: positiveIntEnv("HEALTH_PORT", HEALTH_DEFAULTS.port),
    checkIntervalMs: HEALTH_DEFAULTS.checkIntervalMs,
    checkTimeoutMs: HEALTH_DEFAULTS.checkTimeoutMs,
    resultExpiryMs: HEALTH_DEFAULTS.resultExpiryMs,
  };
}
