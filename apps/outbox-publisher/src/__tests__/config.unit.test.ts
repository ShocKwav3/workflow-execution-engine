import { afterEach, describe, expect, it, vi } from "vitest";
import { OUTBOX_PUBLISHER_DEFAULTS, loadOutboxPublisherConfig } from "@/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadOutboxPublisherConfig", () => {
  it("applies defaults when only REDIS_URL is set", () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const config = loadOutboxPublisherConfig();

    expect(config).toMatchObject({
      ...OUTBOX_PUBLISHER_DEFAULTS,
      redis: { url: "redis://localhost:6379" },
    });
  });

  it("throws when REDIS_URL is missing", () => {
    vi.stubEnv("REDIS_URL", undefined);

    expect(() => loadOutboxPublisherConfig()).toThrow(
      "Missing required environment variable: REDIS_URL",
    );
  });

  it("throws when the lease equals the publish timeout", () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("OUTBOX_LEASE_MS", "5000");
    vi.stubEnv("OUTBOX_PUBLISH_TIMEOUT_MS", "5000");

    expect(() => loadOutboxPublisherConfig()).toThrow(
      "OUTBOX_LEASE_MS (5000) must be greater than OUTBOX_PUBLISH_TIMEOUT_MS (5000)",
    );
  });

  it("throws when a tunable is not a positive integer", () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("OUTBOX_BATCH_SIZE", "0");

    expect(() => loadOutboxPublisherConfig()).toThrow(
      "Environment variable OUTBOX_BATCH_SIZE must be a positive integer, got: 0",
    );
  });
});
