import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Channel } from "amqplib";
import { AmqpConnection } from "@/amqp/AmqpConnection.js";
import {
  AmqpConsumerError,
  ConsumerAlreadySubscribedError,
  UnprocessableMessageError,
} from "@/amqp/errors/index.js";
import type { MessageEnvelope } from "@/amqp/messages/envelope.js";
import type { InboundMessage, MessageHandler } from "@/amqp/MessageConsumer.js";
import { RabbitMqMessageConsumer } from "@/amqp/RabbitMqMessageConsumer.js";
import type { Logger } from "@/logging/types.js";
import { type TestRabbitmq, startTestRabbitmq, stopTestRabbitmq } from "@core-test/testRabbitmq.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

describe("RabbitMqMessageConsumer", () => {
  let rabbitmq: TestRabbitmq;

  // Every worker shares one broker, so each test owns a queue nothing else can deliver to or drain.
  const queues: string[] = [];
  const connections: AmqpConnection[] = [];

  beforeAll(async () => {
    rabbitmq = await startTestRabbitmq();
  }, 60_000);

  afterAll(async () => {
    await stopTestRabbitmq(rabbitmq);
  });

  const withChannel = async <T>(work: (channel: Channel) => Promise<T>): Promise<T> => {
    const channel = await rabbitmq.connectionModel.createChannel();

    // An unhandled channel 'error' is thrown by EventEmitter itself and would end the whole run.
    channel.on("error", () => {});

    try {
      return await work(channel);
    } finally {
      await channel.close().catch(() => {});
    }
  };

  afterEach(async () => {
    await Promise.allSettled(connections.map((connection) => connection.dispose()));
    connections.length = 0;

    for (const queue of queues) {
      await withChannel((channel) => channel.deleteQueue(queue)).catch(() => {});
    }

    queues.length = 0;
  });

  const freshQueue = async (): Promise<string> => {
    const queue = `test.consumer.${randomUUID()}`;

    await withChannel((channel) =>
      channel.assertQueue(queue, { durable: true, arguments: { "x-queue-type": "quorum" } }),
    );
    queues.push(queue);

    return queue;
  };

  const send = async (queue: string, body: unknown): Promise<void> => {
    const content = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const channel = await rabbitmq.connectionModel.createConfirmChannel();

    channel.on("error", () => {});
    channel.sendToQueue(queue, content, { persistent: true });

    await channel.waitForConfirms();
    await channel.close();
  };

  const readyCount = async (queue: string): Promise<number> =>
    await withChannel(async (channel) => (await channel.checkQueue(queue)).messageCount);

  const consumerOn = (queue: string, prefetch = 1) => {
    const connection = new AmqpConnection({ url: rabbitmq.url }, silentLogger);

    connections.push(connection);

    return {
      connection,
      consumer: new RabbitMqMessageConsumer(connection, silentLogger, { queue, prefetch }),
    };
  };

  const envelopeFor = (overrides: Partial<MessageEnvelope> = {}): MessageEnvelope => ({
    messageId: randomUUID(),
    correlationId: randomUUID(),
    type: "TestMessage",
    occurredAt: new Date().toISOString(),
    payload: { hello: "world" },
    ...overrides,
  });

  const recording = () => {
    const received: InboundMessage[] = [];
    const handler: MessageHandler = (message) => {
      received.push(message);

      return Promise.resolve();
    };

    return { received, handler };
  };

  const blocking = () => {
    const received: InboundMessage[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const handler: MessageHandler = async (message) => {
      received.push(message);

      await gate;
    };

    return { received, handler, release: () => release() };
  };

  it("acks a delivered message, so nothing is requeued once the consumer goes away", async () => {
    const queue = await freshQueue();
    const { consumer, connection } = consumerOn(queue);
    const { received, handler } = recording();
    const envelope = envelopeFor();

    await consumer.consume(handler);
    await send(queue, envelope);

    await vi.waitFor(() => expect(received).toHaveLength(1), { timeout: 5_000 });

    expect(received[0]?.envelope).toEqual(envelope);
    expect(received[0]?.redelivered).toBe(false);

    await consumer.stop();
    await connection.dispose();

    expect(await readyCount(queue)).toBe(0);
  });

  it("bounds unacked deliveries to its prefetch while a handler is blocked", async () => {
    const queue = await freshQueue();
    const { consumer } = consumerOn(queue, 1);
    const { received, handler, release } = blocking();

    await consumer.consume(handler);
    await send(queue, envelopeFor());
    await send(queue, envelopeFor());
    await send(queue, envelopeFor());

    await vi.waitFor(() => expect(received).toHaveLength(1), { timeout: 5_000 });
    await vi.waitFor(async () => expect(await readyCount(queue)).toBe(2), { timeout: 5_000 });

    release();

    await vi.waitFor(() => expect(received).toHaveLength(3), { timeout: 5_000 });

    await consumer.stop();
  });

  it("drains in-flight work during stop(), so a later consumer sees no redelivery", async () => {
    const queue = await freshQueue();
    const first = consumerOn(queue);
    const { received, handler, release } = blocking();

    await first.consumer.consume(handler);
    await send(queue, envelopeFor());

    await vi.waitFor(() => expect(received).toHaveLength(1), { timeout: 5_000 });

    const stopped = first.consumer.stop();

    release();

    await stopped;
    await first.connection.dispose();

    const second = consumerOn(queue);
    const later = recording();

    await second.consumer.consume(later.handler);
    await new Promise((resolve) => setTimeout(resolve, 750));

    expect(later.received).toHaveLength(0);
    expect(await readyCount(queue)).toBe(0);

    await second.consumer.stop();
  });

  it("discards the ack for a delivery whose channel died, and lets the broker redeliver", async () => {
    const queue = await freshQueue();
    const first = consumerOn(queue);
    const { received, handler, release } = blocking();
    const envelope = envelopeFor();

    await first.consumer.consume(handler);
    await send(queue, envelope);

    await vi.waitFor(() => expect(received).toHaveLength(1), { timeout: 5_000 });

    // Losing the connection takes its channel with it, and the broker requeues what was unacked.
    await first.connection.dispose();

    release();

    const second = consumerOn(queue);
    const later = recording();

    await second.consumer.consume(later.handler);

    await vi.waitFor(() => expect(later.received).toHaveLength(1), { timeout: 10_000 });

    expect(later.received[0]?.envelope.messageId).toBe(envelope.messageId);
    expect(later.received[0]?.redelivered).toBe(true);

    await second.consumer.stop();
  }, 20_000);

  it("surfaces a broker-initiated cancel it cannot resubscribe from", async () => {
    const queue = await freshQueue();
    const { consumer } = consumerOn(queue);
    const { handler } = recording();

    await consumer.consume(handler);

    // Deleting the queue cancels the consumer, and the queue it resubscribes to is now gone.
    await withChannel((channel) => channel.deleteQueue(queue));

    await expect(consumer.finished()).rejects.toThrow();
  }, 15_000);

  it("drops what it cannot decode without invoking the handler, and keeps consuming", async () => {
    const queue = await freshQueue();
    const { consumer } = consumerOn(queue);
    const { received, handler } = recording();

    await consumer.consume(handler);
    await send(queue, Buffer.from("not json"));
    await send(queue, { messageId: "not-a-uuid" });

    await vi.waitFor(async () => expect(await readyCount(queue)).toBe(0), { timeout: 5_000 });

    expect(received).toHaveLength(0);

    const envelope = envelopeFor();

    await send(queue, envelope);

    await vi.waitFor(() => expect(received).toHaveLength(1), { timeout: 5_000 });

    expect(received[0]?.envelope.messageId).toBe(envelope.messageId);

    await consumer.stop();
  });

  it("drops a message its handler declares unprocessable, and keeps consuming", async () => {
    const queue = await freshQueue();
    const { consumer } = consumerOn(queue);
    const bad = envelopeFor();
    const good = envelopeFor();
    const seen: string[] = [];
    const handler: MessageHandler = ({ envelope }) => {
      seen.push(envelope.messageId);

      return envelope.messageId === bad.messageId
        ? Promise.reject(new UnprocessableMessageError("test"))
        : Promise.resolve();
    };

    await consumer.consume(handler);
    await send(queue, bad);
    await send(queue, good);

    await vi.waitFor(() => expect(seen).toHaveLength(2), { timeout: 5_000 });
    await vi.waitFor(async () => expect(await readyCount(queue)).toBe(0), { timeout: 5_000 });

    expect(seen).toEqual([bad.messageId, good.messageId]);

    await consumer.stop();
    await expect(consumer.finished()).resolves.toBeUndefined();
  });

  it("refuses a second subscription on the same instance", async () => {
    const queue = await freshQueue();
    const { consumer } = consumerOn(queue);
    const { handler } = recording();

    await consumer.consume(handler);

    await expect(consumer.consume(handler)).rejects.toBeInstanceOf(ConsumerAlreadySubscribedError);

    await consumer.stop();
  });

  it("never acks a delivery whose handler threw, and stops consuming for good", async () => {
    const queue = await freshQueue();
    const first = consumerOn(queue);
    const envelope = envelopeFor();
    const failing: MessageHandler = () => Promise.reject(new Error("handler exploded"));

    await first.consumer.consume(failing);
    await send(queue, envelope);

    await expect(first.consumer.finished()).rejects.toThrow("handler exploded");

    await first.connection.dispose();

    const second = consumerOn(queue);
    const later = recording();

    await second.consumer.consume(later.handler);

    await vi.waitFor(() => expect(later.received).toHaveLength(1), { timeout: 10_000 });

    expect(later.received[0]?.envelope.messageId).toBe(envelope.messageId);
    expect(later.received[0]?.redelivered).toBe(true);

    await second.consumer.stop();
  }, 20_000);

  it("reports a subscription that can never succeed instead of claiming it worked", async () => {
    const { consumer } = consumerOn(`test.consumer.missing.${randomUUID()}`);
    const { handler } = recording();

    await expect(consumer.consume(handler)).rejects.toBeInstanceOf(AmqpConsumerError);
    await expect(consumer.finished()).rejects.toThrow();
  }, 15_000);
});
