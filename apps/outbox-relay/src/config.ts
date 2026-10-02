import { positiveIntEnv } from "@workflow-engine/core/config/env.js";

export interface OutboxRelayConfig {
  pollIntervalMs: number;
  batchSize: number;
  leaseMs: number;
  publishTimeoutMs: number;
  maxBackoffMs: number;
}

export const OUTBOX_RELAY_DEFAULTS = {
  pollIntervalMs: 1_000,
  batchSize: 50,
  leaseMs: 30_000,
  publishTimeoutMs: 5_000,
  maxBackoffMs: 30_000,
} as const;

export function loadOutboxRelayConfig(): OutboxRelayConfig {
  const config: OutboxRelayConfig = {
    pollIntervalMs: positiveIntEnv("OUTBOX_POLL_INTERVAL_MS", OUTBOX_RELAY_DEFAULTS.pollIntervalMs),
    batchSize: positiveIntEnv("OUTBOX_BATCH_SIZE", OUTBOX_RELAY_DEFAULTS.batchSize),
    leaseMs: positiveIntEnv("OUTBOX_LEASE_MS", OUTBOX_RELAY_DEFAULTS.leaseMs),
    publishTimeoutMs: positiveIntEnv(
      "OUTBOX_PUBLISH_TIMEOUT_MS",
      OUTBOX_RELAY_DEFAULTS.publishTimeoutMs,
    ),
    maxBackoffMs: OUTBOX_RELAY_DEFAULTS.maxBackoffMs,
  };

  // A publish that outlives its lease lets a second claimer publish the same row concurrently.
  if (config.leaseMs <= config.publishTimeoutMs) {
    throw new Error(
      `OUTBOX_LEASE_MS (${config.leaseMs}) must be greater than OUTBOX_PUBLISH_TIMEOUT_MS (${config.publishTimeoutMs})`,
    );
  }

  return config;
}
