import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Channel } from "amqplib";
import { AmqpConnection } from "@/amqp/AmqpConnection.js";
import { AmqpConnectionError } from "@/amqp/errors/index.js";
import type { RecoveringChannelOptions } from "@/amqp/RecoveringChannel.js";
import type { Logger } from "@/logging/types.js";
import { type TestRabbitmq, startTestRabbitmq, stopTestRabbitmq } from "@core-test/testRabbitmq.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

describe("AmqpConnection and RecoveringChannel", () => {
  let rabbitmq: TestRabbitmq;
  const connections: AmqpConnection[] = [];

  beforeAll(async () => {
    rabbitmq = await startTestRabbitmq();
  }, 60_000);

  afterAll(async () => {
    await stopTestRabbitmq(rabbitmq);
  });

  afterEach(async () => {
    await Promise.allSettled(connections.map((connection) => connection.dispose()));
    connections.length = 0;
  });

  const newConnection = (): AmqpConnection => {
    const connection = new AmqpConnection({ url: rabbitmq.url }, silentLogger);

    connections.push(connection);

    return connection;
  };

  // Counts every physical channel created, so tests can see replacements and duplicates.
  const plainChannel = (
    connection: AmqpConnection,
    overrides: Partial<RecoveringChannelOptions<Channel>> = {},
  ) => {
    const created: Channel[] = [];
    const closed: Channel[] = [];
    const recovering = connection.createRecoveringChannel<Channel>({
      create: async () => {
        const channel = await connection.createChannel();

        created.push(channel);
        channel.on("close", () => closed.push(channel));

        return channel;
      },
      configure: () => Promise.resolve(),
      maxAttempts: 2,
      initialRetryDelayMs: 50,
      maxRetryDelayMs: 1_000,
      ...overrides,
    });

    return { recovering, created, closed };
  };

  describe("AmqpConnection", () => {
    it("returns the same start promise to every caller", async () => {
      const connection = newConnection();
      const first = connection.start();

      expect(connection.start()).toBe(first);

      await first;

      expect(connection.isUp()).toBe(true);
    });

    it("disposes once, however many times it is asked", async () => {
      const connection = newConnection();

      await connection.start();

      const first = connection.dispose();

      expect(connection.dispose()).toBe(first);

      await first;

      expect(connection.isUp()).toBe(false);
    });

    it("refuses to start after disposal", async () => {
      const connection = newConnection();

      await connection.dispose();

      await expect(connection.start()).rejects.toBeInstanceOf(AmqpConnectionError);
    });
  });

  describe("RecoveringChannel", () => {
    it("becomes ready only after configure has succeeded", async () => {
      const connection = newConnection();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const { recovering } = plainChannel(connection, { configure: () => gate });

      await connection.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(recovering.current()).toBeUndefined();

      release();
      await recovering.ready();

      expect(recovering.current()).toBeDefined();
    });

    it("closes each channel whose configure failed, retries, then gives up", async () => {
      const connection = newConnection();
      const { recovering, created, closed } = plainChannel(connection, {
        configure: () => Promise.reject(new Error("configure failed")),
      });

      await connection.start();

      await expect(recovering.failed()).rejects.toThrow("configure failed");
      await expect(recovering.ready()).rejects.toThrow("configure failed");

      expect(created).toHaveLength(2);
      await vi.waitFor(() => expect(closed).toHaveLength(2), { timeout: 2_000 });
      expect(recovering.current()).toBeUndefined();
    });

    it("doubles the delay between consecutive setup failures", async () => {
      const connection = newConnection();
      const attemptedAt: number[] = [];
      const { recovering } = plainChannel(connection, {
        configure: () => {
          attemptedAt.push(Date.now());

          return Promise.reject(new Error("configure failed"));
        },
        maxAttempts: 3,
        initialRetryDelayMs: 100,
      });

      await connection.start();
      await expect(recovering.failed()).rejects.toThrow("configure failed");

      const [first = 0, second = 0, third = 0] = attemptedAt;

      expect(attemptedAt).toHaveLength(3);
      expect(second - first).toBeGreaterThanOrEqual(90);
      expect(third - second).toBeGreaterThanOrEqual(190);
    });

    it("replaces a channel that closed while the connection stayed up", async () => {
      const connection = newConnection();
      const { recovering } = plainChannel(connection);

      await connection.start();
      await recovering.ready();

      const first = recovering.current();

      await first?.close();

      await vi.waitFor(
        () => {
          expect(recovering.current()).toBeDefined();
          expect(recovering.current()).not.toBe(first);
        },
        { timeout: 2_000 },
      );
    });

    it("never creates a second channel while one is current", async () => {
      const connection = newConnection();
      const { recovering, created } = plainChannel(connection);

      await connection.start();
      await recovering.ready();
      await Promise.all([recovering.open(), recovering.open()]);

      expect(created).toHaveLength(1);
    });

    it("does not replace a channel once recovery is disabled", async () => {
      const connection = newConnection();
      const { recovering, created } = plainChannel(connection);

      await connection.start();
      await recovering.ready();

      recovering.disableRecovery();
      await recovering.current()?.close();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(recovering.current()).toBeUndefined();
      expect(created).toHaveLength(1);
    });

    it("rejects ready() when recovery is disabled before the first channel", async () => {
      const connection = newConnection();
      const { recovering } = plainChannel(connection);

      recovering.disableRecovery();

      await expect(recovering.ready()).rejects.toThrow();
    });

    it("closes once, however many times it is asked", async () => {
      const connection = newConnection();
      const { recovering, closed } = plainChannel(connection);

      await connection.start();
      await recovering.ready();

      const first = recovering.close();

      expect(recovering.close()).toBe(first);

      await first;

      expect(recovering.current()).toBeUndefined();
      await vi.waitFor(() => expect(closed).toHaveLength(1), { timeout: 2_000 });
    });
  });
});
