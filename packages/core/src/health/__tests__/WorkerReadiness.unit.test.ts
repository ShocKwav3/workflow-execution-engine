import { describe, expect, it } from "vitest";
import { DependencyStatusRecord } from "@/health/DependencyStatusRecord.js";
import { WorkerReadiness } from "@/health/WorkerReadiness.js";
import type { Logger } from "@/logging/types.js";

interface LogLine {
  level: string;
  msg: string;
  obj: unknown;
}

function recordingLogger(): { logger: Logger; lines: LogLine[] } {
  const lines: LogLine[] = [];
  const record =
    (level: string) =>
    (obj: unknown, msg?: string): void => {
      lines.push({ level, msg: msg ?? "", obj });
    };

  const logger: Logger = {
    child: () => logger,
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
    fatal: record("fatal"),
  };

  return { logger, lines };
}

function setup() {
  const postgres = new DependencyStatusRecord({ expiryMs: 12_000, now: () => 1_000 });
  const redis = new DependencyStatusRecord({ expiryMs: 12_000, now: () => 1_000 });
  const { logger, lines } = recordingLogger();
  const readiness = new WorkerReadiness({ postgres, redis }, logger);

  return { postgres, redis, readiness, lines };
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

  describe("log lines", () => {
    it("logs each dependency becoming available, then the worker ready", () => {
      const { postgres, redis, readiness, lines } = setup();

      readiness.markRunning();
      postgres.markAvailable(postgres.generation);
      redis.markAvailable(redis.generation);

      expect(lines).toEqual([
        { level: "info", msg: "dependency available", obj: { dependency: "postgres" } },
        { level: "info", msg: "dependency available", obj: { dependency: "redis" } },
        { level: "info", msg: "worker ready", obj: {} },
      ]);
    });

    it("logs a lost dependency and the worker not ready, with the reason", () => {
      const { postgres, redis, readiness, lines } = setup();

      postgres.markAvailable(postgres.generation);
      redis.markAvailable(redis.generation);
      readiness.markRunning();
      lines.length = 0;

      redis.connectionLost("connect ECONNREFUSED 127.0.0.1:6379");

      expect(lines).toEqual([
        {
          level: "warn",
          msg: "dependency unavailable",
          obj: { dependency: "redis", reason: "connect ECONNREFUSED 127.0.0.1:6379" },
        },
        {
          level: "warn",
          msg: "worker not ready",
          obj: { phase: "running", unavailable: { redis: "connect ECONNREFUSED 127.0.0.1:6379" } },
        },
      ]);
    });

    it("does not log again while a dependency stays unavailable", () => {
      const { redis, lines } = setup();

      redis.connectionLost("connect ECONNREFUSED 127.0.0.1:6379");
      redis.connectionLost("connection closed");
      redis.markUnavailable(redis.generation, "check timed out");

      expect(lines.filter((line) => line.msg === "dependency unavailable")).toHaveLength(1);
    });

    it("logs the worker not ready at info level during shutdown", () => {
      const { postgres, redis, readiness, lines } = setup();

      postgres.markAvailable(postgres.generation);
      redis.markAvailable(redis.generation);
      readiness.markRunning();
      lines.length = 0;

      readiness.markStopping();

      expect(lines).toEqual([
        { level: "info", msg: "worker not ready", obj: { phase: "stopping" } },
      ]);
    });

    it("does not log a verdict while starting, because the worker was never ready", () => {
      const { redis, lines } = setup();

      redis.connectionLost("connect ECONNREFUSED 127.0.0.1:6379");

      expect(lines.map((line) => line.msg)).toEqual(["dependency unavailable"]);
    });
  });
});
