import { afterEach, describe, expect, it, vi } from "vitest";
import { HEALTH_DEFAULTS, loadHealthConfig } from "@/config/healthConfig.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadHealthConfig", () => {
  it("uses the defaults when HEALTH_PORT is not set", () => {
    vi.stubEnv("HEALTH_PORT", undefined);

    expect(loadHealthConfig()).toEqual(HEALTH_DEFAULTS);
  });

  it("reads HEALTH_PORT", () => {
    vi.stubEnv("HEALTH_PORT", "9000");

    expect(loadHealthConfig().port).toBe(9000);
  });

  it("throws when HEALTH_PORT is not a positive integer", () => {
    vi.stubEnv("HEALTH_PORT", "abc");

    expect(() => loadHealthConfig()).toThrow("HEALTH_PORT");
  });
});
