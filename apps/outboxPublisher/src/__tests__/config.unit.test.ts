import { afterEach, describe, expect, it } from "vitest";
import { loadOutboxPublisherConfig, OUTBOX_PUBLISHER_DEFAULTS } from "@/config.js";

const ENV_VARS = [
  "OUTBOX_POLL_INTERVAL_MS",
  "OUTBOX_BATCH_SIZE",
  "OUTBOX_STALE_CLAIM_SECONDS",
] as const;

afterEach(() => {
  for (const name of ENV_VARS) {
    delete process.env[name];
  }
});

describe("loadOutboxPublisherConfig", () => {
  it("falls back to the defaults when nothing is set", () => {
    expect(loadOutboxPublisherConfig()).toEqual(OUTBOX_PUBLISHER_DEFAULTS);
  });

  it("reads whole integers from the environment", () => {
    process.env.OUTBOX_POLL_INTERVAL_MS = "250";
    process.env.OUTBOX_BATCH_SIZE = "5";
    process.env.OUTBOX_STALE_CLAIM_SECONDS = "60";

    expect(loadOutboxPublisherConfig()).toEqual({
      pollIntervalMs: 250,
      batchSize: 5,
      staleClaimSeconds: 60,
    });
  });

  it.each(["0", "-1", "10ms", "1.5", "abc", "1e3"])("refuses to start on %s", (value) => {
    process.env.OUTBOX_BATCH_SIZE = value;

    expect(() => loadOutboxPublisherConfig()).toThrowError(/OUTBOX_BATCH_SIZE/);
  });

  it.each(ENV_VARS)("validates %s", (name) => {
    process.env[name] = "0";

    expect(() => loadOutboxPublisherConfig()).toThrowError(new RegExp(name));
  });
});
