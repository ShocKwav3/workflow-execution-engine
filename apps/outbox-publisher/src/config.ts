import { positiveIntEnv } from "@workflow-engine/core/config/env.js";
import { loadLogConfig, type LogConfig } from "@workflow-engine/core/config/logConfig.js";
import { loadRedisConfig, type RedisConfig } from "@workflow-engine/core/config/redisConfig.js";

export interface OutboxPublisherConfig {
  pollIntervalMs: number;
  batchSize: number;
  leaseMs: number;
  publishTimeoutMs: number;
  redis: RedisConfig;
  log: LogConfig;
}

export const OUTBOX_PUBLISHER_DEFAULTS = {
  pollIntervalMs: 1_000,
  batchSize: 50,
  leaseMs: 30_000,
  publishTimeoutMs: 5_000,
} as const;

export function loadOutboxPublisherConfig(): OutboxPublisherConfig {
  const config: OutboxPublisherConfig = {
    pollIntervalMs: positiveIntEnv(
      "OUTBOX_POLL_INTERVAL_MS",
      OUTBOX_PUBLISHER_DEFAULTS.pollIntervalMs,
    ),
    batchSize: positiveIntEnv("OUTBOX_BATCH_SIZE", OUTBOX_PUBLISHER_DEFAULTS.batchSize),
    leaseMs: positiveIntEnv("OUTBOX_LEASE_MS", OUTBOX_PUBLISHER_DEFAULTS.leaseMs),
    publishTimeoutMs: positiveIntEnv(
      "OUTBOX_PUBLISH_TIMEOUT_MS",
      OUTBOX_PUBLISHER_DEFAULTS.publishTimeoutMs,
    ),
    redis: loadRedisConfig(),
    log: loadLogConfig(),
  };

  // A publish that outlives its lease lets a second claimer publish the same row concurrently.
  if (config.leaseMs <= config.publishTimeoutMs) {
    throw new Error(
      `OUTBOX_LEASE_MS (${config.leaseMs}) must be greater than OUTBOX_PUBLISH_TIMEOUT_MS (${config.publishTimeoutMs})`,
    );
  }

  return config;
}
