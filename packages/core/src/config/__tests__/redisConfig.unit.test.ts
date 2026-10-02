import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRedisConfig } from "@/config/redisConfig.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadRedisConfig", () => {
  it("reads REDIS_URL", () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    expect(loadRedisConfig()).toEqual({ url: "redis://localhost:6379" });
  });

  it("throws when REDIS_URL is missing", () => {
    vi.stubEnv("REDIS_URL", undefined);

    expect(() => loadRedisConfig()).toThrow("Missing required environment variable: REDIS_URL");
  });
});
