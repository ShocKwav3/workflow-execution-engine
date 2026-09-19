import { positiveIntEnv } from "@workflow-engine/core/config/env.js";

export interface OutboxPublisherConfig {
  pollIntervalMs: number;
  batchSize: number;
  staleClaimSeconds: number;
}

export const OUTBOX_PUBLISHER_DEFAULTS = {
  pollIntervalMs: 1_000,
  batchSize: 20,
  staleClaimSeconds: 30,
} as const;

export function loadOutboxPublisherConfig(): OutboxPublisherConfig {
  return {
    pollIntervalMs: positiveIntEnv(
      "OUTBOX_POLL_INTERVAL_MS",
      OUTBOX_PUBLISHER_DEFAULTS.pollIntervalMs,
    ),
    batchSize: positiveIntEnv("OUTBOX_BATCH_SIZE", OUTBOX_PUBLISHER_DEFAULTS.batchSize),
    staleClaimSeconds: positiveIntEnv(
      "OUTBOX_STALE_CLAIM_SECONDS",
      OUTBOX_PUBLISHER_DEFAULTS.staleClaimSeconds,
    ),
  };
}
