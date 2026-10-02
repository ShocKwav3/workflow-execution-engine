import { describe, expect, it } from "vitest";
import type { Logger } from "@/logging/types.js";
import { RedisConnectionMonitor } from "@/redis/RedisConnectionMonitor.js";

function recordingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger: Logger = {
    child: () => logger,
    info: (_obj, msg) => lines.push(`info:${msg ?? ""}`),
    warn: (_obj, msg) => lines.push(`warn:${msg ?? ""}`),
    error: (_obj, msg) => lines.push(`error:${msg ?? ""}`),
    fatal: (_obj, msg) => lines.push(`fatal:${msg ?? ""}`),
  };

  return { logger, lines };
}

function connectionRefused(): Error & { code: string } {
  return Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:6379"), { code: "ECONNREFUSED" });
}

describe("RedisConnectionMonitor", () => {
  it("logs when the connection becomes ready", () => {
    const { logger, lines } = recordingLogger();
    const monitor = new RedisConnectionMonitor(logger);

    monitor.onReady();

    expect(lines).toEqual(["info:redis connection ready"]);
  });

  it("stays silent on close before the first ready", () => {
    const { logger, lines } = recordingLogger();
    const monitor = new RedisConnectionMonitor(logger);

    monitor.onClose();

    expect(lines).toEqual([]);
  });

  it("warns once when a ready connection closes", () => {
    const { logger, lines } = recordingLogger();
    const monitor = new RedisConnectionMonitor(logger);

    monitor.onReady();
    monitor.onClose();
    monitor.onClose();

    expect(lines).toEqual([
      "info:redis connection ready",
      "warn:redis connection lost; reconnecting",
    ]);
  });

  it("logs a repeated cause once, even as new error objects", () => {
    const { logger, lines } = recordingLogger();
    const monitor = new RedisConnectionMonitor(logger);

    monitor.onError(connectionRefused());
    monitor.onError(connectionRefused());

    expect(lines).toEqual(["warn:redis unavailable"]);
  });

  it("logs a new cause", () => {
    const { logger, lines } = recordingLogger();
    const monitor = new RedisConnectionMonitor(logger);

    monitor.onError(connectionRefused());
    monitor.onError(Object.assign(new Error("Command timed out"), { code: undefined }));

    expect(lines).toEqual(["warn:redis unavailable", "warn:redis unavailable"]);
  });

  it("logs a cause again after the connection recovered", () => {
    const { logger, lines } = recordingLogger();
    const monitor = new RedisConnectionMonitor(logger);

    monitor.onError(connectionRefused());
    monitor.onReady();
    monitor.onError(connectionRefused());

    expect(lines).toEqual([
      "warn:redis unavailable",
      "info:redis connection ready",
      "warn:redis unavailable",
    ]);
  });
});
