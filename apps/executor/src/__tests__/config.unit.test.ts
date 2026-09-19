import { afterEach, describe, expect, it } from "vitest";
import { EXECUTOR_DEFAULTS, loadExecutorConfig } from "@/config.js";

afterEach(() => {
  delete process.env.EXECUTOR_PREFETCH;
});

describe("loadExecutorConfig", () => {
  it("falls back to the defaults when nothing is set", () => {
    expect(loadExecutorConfig()).toEqual(EXECUTOR_DEFAULTS);
  });

  it("reads a whole integer from the environment", () => {
    process.env.EXECUTOR_PREFETCH = "10";

    expect(loadExecutorConfig()).toEqual({ prefetch: 10 });
  });

  it.each(["0", "-1", "10ms", "1.5", "abc", "1e3"])("refuses to start on %s", (value) => {
    process.env.EXECUTOR_PREFETCH = value;

    expect(() => loadExecutorConfig()).toThrowError(/EXECUTOR_PREFETCH/);
  });
});
