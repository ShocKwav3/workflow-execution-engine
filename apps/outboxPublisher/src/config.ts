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

// Zero, negative and half-numeric values ("10ms") would otherwise fail once per poll cycle forever.
function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
  }

  return Number(raw);
}

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
