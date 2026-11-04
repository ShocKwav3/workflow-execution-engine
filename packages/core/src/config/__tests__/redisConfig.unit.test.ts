import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRedisConfig } from "@/config/redisConfig.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadRedisConfig", () => {
  it("reads REDIS_URL", () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("REDIS_URL_FILE", undefined);

    expect(loadRedisConfig()).toEqual({ url: "redis://localhost:6379" });
  });

  it("reads REDIS_URL_FILE when it is set", () => {
    const path = join(mkdtempSync(join(tmpdir(), "redis-config-test-")), "url");

    writeFileSync(path, "redis://redis:6379\n");
    vi.stubEnv("REDIS_URL", undefined);
    vi.stubEnv("REDIS_URL_FILE", path);

    expect(loadRedisConfig()).toEqual({ url: "redis://redis:6379" });
  });

  it("throws when REDIS_URL is missing", () => {
    vi.stubEnv("REDIS_URL", undefined);
    vi.stubEnv("REDIS_URL_FILE", undefined);

    expect(() => loadRedisConfig()).toThrow("Missing required environment variable: REDIS_URL");
  });
});
