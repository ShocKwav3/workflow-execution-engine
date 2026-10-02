import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@/logging/types.js";
import { RedisConnection } from "@/redis/RedisConnection.js";
import { testRedisUrl } from "@core-test/testRedis.js";

function recordingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger: Logger = {
    child: () => logger,
    info: (_obj, msg) => lines.push(msg ?? ""),
    warn: (_obj, msg) => lines.push(msg ?? ""),
    error: (_obj, msg) => lines.push(msg ?? ""),
    fatal: (_obj, msg) => lines.push(msg ?? ""),
  };

  return { logger, lines };
}

function connect(url: string, logger: Logger): RedisConnection {
  return new RedisConnection({ url }, logger);
}

describe("RedisConnection", () => {
  let connection: RedisConnection | undefined;

  afterEach(async () => {
    await connection?.dispose();
    connection = undefined;
  });

  it("passes the given options to the client", () => {
    connection = new RedisConnection(
      { url: testRedisUrl(), enableOfflineQueue: false, commandTimeoutMs: 1_234 },
      recordingLogger().logger,
    );

    expect(connection.client.options.enableOfflineQueue).toBe(false);
    expect(connection.client.options.commandTimeout).toBe(1_234);
  });

  it("keeps the client defaults for options that were not given", () => {
    connection = connect(testRedisUrl(), recordingLogger().logger);

    expect(connection.client.options.enableOfflineQueue).toBe(true);
    expect(connection.client.options.commandTimeout).toBeUndefined();
  });

  it("becomes ready against a running server", async () => {
    const { logger, lines } = recordingLogger();

    connection = connect(testRedisUrl(), logger);

    await vi.waitFor(() => expect(connection?.isReady()).toBe(true));
    expect(lines).toEqual(["redis connection ready"]);
  });

  it("reports a lost connection and its recovery", async () => {
    const { logger, lines } = recordingLogger();

    connection = connect(testRedisUrl(), logger);
    await vi.waitFor(() => expect(connection?.isReady()).toBe(true));

    connection.client.disconnect(true);

    await vi.waitFor(() =>
      expect(lines).toEqual([
        "redis connection ready",
        "redis connection lost; reconnecting",
        "redis connection ready",
      ]),
    );
  });

  it("rejects commands immediately while disconnected when the offline queue is off", async () => {
    connection = new RedisConnection(
      { url: "redis://127.0.0.1:1", enableOfflineQueue: false },
      recordingLogger().logger,
    );

    expect(connection.isReady()).toBe(false);
    await expect(connection.client.ping()).rejects.toThrow("enableOfflineQueue");
  });

  // The socket closes asynchronously, so "end" is reached after dispose() returns.
  it("stops reconnecting a connection that never became ready", async () => {
    const unreachable = connect("redis://127.0.0.1:1", recordingLogger().logger);

    await unreachable.dispose();

    await vi.waitFor(() => expect(unreachable.client.status).toBe("end"));
  });
});
