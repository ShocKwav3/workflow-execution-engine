import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ConfirmChannel } from "amqplib";
import { AmqpConnectionError } from "@/amqp/errors/index.js";
import { RabbitMqMessagePublisher } from "@/amqp/RabbitMqMessagePublisher.js";
import { AMQP_TOPOLOGY } from "@/amqp/topology.js";
import type { Logger } from "@/logging/types.js";
import { type TestRabbitmq, startTestRabbitmq, stopTestRabbitmq } from "@core-test/testRabbitmq.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

describe("RabbitMqMessagePublisher", () => {
  let rabbitmq: TestRabbitmq;
  let publisher: RabbitMqMessagePublisher;
  let inspector: ConfirmChannel;

  beforeAll(async () => {
    rabbitmq = await startTestRabbitmq();
    publisher = new RabbitMqMessagePublisher({ url: rabbitmq.url }, silentLogger);

    await publisher.ready();

    inspector = await rabbitmq.connectionModel.createConfirmChannel();
  }, 60_000);

  afterAll(async () => {
    await publisher.dispose();
    await stopTestRabbitmq(rabbitmq);
  });

  beforeEach(async () => {
    await inspector.purgeQueue(AMQP_TOPOLOGY.queue);
  });

  it("declares its own topology, so it can publish against a fresh broker", async () => {
    const queue = await inspector.checkQueue(AMQP_TOPOLOGY.queue);

    expect(queue.queue).toBe(AMQP_TOPOLOGY.queue);
  });

  it("delivers a persistent message to the bound queue", async () => {
    const messageId = randomUUID();

    await publisher.publish({
      messageId,
      routingKey: AMQP_TOPOLOGY.routingKey,
      body: { hello: "world" },
    });

    const delivered = await inspector.get(AMQP_TOPOLOGY.queue, { noAck: true });

    expect(delivered).not.toBe(false);

    if (delivered === false) {
      return;
    }

    expect(JSON.parse(delivered.content.toString())).toEqual({ hello: "world" });
    expect(delivered.properties.messageId).toBe(messageId);
    expect(delivered.properties.deliveryMode).toBe(2);
    expect(delivered.properties.contentType).toBe("application/json");
  });

  it("rejects with a classified error when no channel is available yet", async () => {
    const unconnected = new RabbitMqMessagePublisher({ url: rabbitmq.url }, silentLogger);

    const published = unconnected.publish({
      messageId: randomUUID(),
      routingKey: AMQP_TOPOLOGY.routingKey,
      body: {},
    });

    await expect(published).rejects.toBeInstanceOf(AmqpConnectionError);

    await unconnected.ready();
    await unconnected.dispose();
  });
});
