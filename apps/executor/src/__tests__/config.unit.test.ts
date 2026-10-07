import { afterEach, describe, expect, it, vi } from "vitest";
import { EXECUTOR_DEFAULTS, loadExecutorConfig } from "@/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadExecutorConfig", () => {
  it("applies defaults when nothing is set", () => {
    vi.stubEnv("EXECUTOR_CONCURRENCY", undefined);

    expect(loadExecutorConfig()).toEqual(EXECUTOR_DEFAULTS);
  });

  it("reads concurrency from the environment", () => {
    vi.stubEnv("EXECUTOR_CONCURRENCY", "4");

    expect(loadExecutorConfig().concurrency).toBe(4);
  });

  it("throws when concurrency is not a positive integer", () => {
    vi.stubEnv("EXECUTOR_CONCURRENCY", "0");

    expect(() => loadExecutorConfig()).toThrow(
      "Environment variable EXECUTOR_CONCURRENCY must be a positive integer, got: 0",
    );
  });
});
