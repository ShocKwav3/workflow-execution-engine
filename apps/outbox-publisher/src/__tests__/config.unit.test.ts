import { afterEach, describe, expect, it, vi } from "vitest";
import { OUTBOX_PUBLISHER_DEFAULTS, loadOutboxPublisherConfig } from "@/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadOutboxPublisherConfig", () => {
  it("applies defaults when nothing is set", () => {
    for (const name of [
      "OUTBOX_POLL_INTERVAL_MS",
      "OUTBOX_BATCH_SIZE",
      "OUTBOX_LEASE_MS",
      "OUTBOX_PUBLISH_TIMEOUT_MS",
    ]) {
      vi.stubEnv(name, undefined);
    }

    const config = loadOutboxPublisherConfig();

    expect(config).toEqual(OUTBOX_PUBLISHER_DEFAULTS);
  });

  it("throws when the lease equals the publish timeout", () => {
    vi.stubEnv("OUTBOX_LEASE_MS", "5000");
    vi.stubEnv("OUTBOX_PUBLISH_TIMEOUT_MS", "5000");

    expect(() => loadOutboxPublisherConfig()).toThrow(
      "OUTBOX_LEASE_MS (5000) must be greater than OUTBOX_PUBLISH_TIMEOUT_MS (5000)",
    );
  });

  it("throws when a tunable is not a positive integer", () => {
    vi.stubEnv("OUTBOX_BATCH_SIZE", "0");

    expect(() => loadOutboxPublisherConfig()).toThrow(
      "Environment variable OUTBOX_BATCH_SIZE must be a positive integer, got: 0",
    );
  });
});
