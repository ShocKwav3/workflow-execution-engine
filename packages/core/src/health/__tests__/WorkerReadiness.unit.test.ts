import { describe, expect, it } from "vitest";
import { DependencyStatusRecord } from "@/health/DependencyStatusRecord.js";
import { WorkerReadiness } from "@/health/WorkerReadiness.js";

function setup() {
  const postgres = new DependencyStatusRecord({ expiryMs: 12_000, now: () => 1_000 });
  const redis = new DependencyStatusRecord({ expiryMs: 12_000, now: () => 1_000 });
  const readiness = new WorkerReadiness({ postgres, redis });

  return { postgres, redis, readiness };
}

describe("WorkerReadiness", () => {
  it("is not ready while starting, even when all dependencies are available", () => {
    const { postgres, redis, readiness } = setup();

    postgres.markAvailable(postgres.generation);
    redis.markAvailable(redis.generation);

    expect(readiness.evaluate()).toMatchObject({ ready: false, phase: "starting" });
  });

  it("is ready when running and all dependencies are available", () => {
    const { postgres, redis, readiness } = setup();

    postgres.markAvailable(postgres.generation);
    redis.markAvailable(redis.generation);

    readiness.markRunning();

    expect(readiness.evaluate()).toMatchObject({ ready: true, phase: "running" });
  });

  it("is not ready when running and a dependency is still unknown", () => {
    const { postgres, readiness } = setup();

    postgres.markAvailable(postgres.generation);

    readiness.markRunning();

    expect(readiness.evaluate()).toMatchObject({
      ready: false,
      dependencies: { postgres: { state: "available" }, redis: { state: "unknown" } },
    });
  });

  it("is not ready when running and a dependency is unavailable, and reports the reason", () => {
    const { postgres, redis, readiness } = setup();

    postgres.markAvailable(postgres.generation);
    redis.connectionLost("connect ECONNREFUSED 127.0.0.1:6379");

    readiness.markRunning();

    expect(readiness.evaluate()).toMatchObject({
      ready: false,
      dependencies: {
        redis: { state: "unavailable", reason: "connect ECONNREFUSED 127.0.0.1:6379" },
      },
    });
  });

  it("is not ready while stopping", () => {
    const { postgres, redis, readiness } = setup();

    postgres.markAvailable(postgres.generation);
    redis.markAvailable(redis.generation);
    readiness.markRunning();

    readiness.markStopping();

    expect(readiness.evaluate()).toMatchObject({ ready: false, phase: "stopping" });
  });

  it("stays stopping when markRunning is called after markStopping", () => {
    const { readiness } = setup();

    readiness.markStopping();
    readiness.markRunning();

    expect(readiness.evaluate().phase).toBe("stopping");
  });
});
