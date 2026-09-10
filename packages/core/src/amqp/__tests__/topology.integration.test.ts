import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AMQP_TOPOLOGY, declareTopology } from "@/amqp/topology.js";
import { type TestRabbitmq, startTestRabbitmq, stopTestRabbitmq } from "@core-test/testRabbitmq.js";

describe("declareTopology", () => {
  let rabbitmq: TestRabbitmq;

  beforeAll(async () => {
    rabbitmq = await startTestRabbitmq();
  }, 60_000);

  afterAll(async () => {
    await stopTestRabbitmq(rabbitmq);
  });

  it("declares the exchange, queue, and binding", async () => {
    const channel = await rabbitmq.connectionModel.createChannel();

    await expect(declareTopology(channel)).resolves.toBeUndefined();

    await channel.close();
  });

  it("is idempotent — redeclaring identical topology does not throw", async () => {
    const channel = await rabbitmq.connectionModel.createChannel();

    await declareTopology(channel);
    await expect(declareTopology(channel)).resolves.toBeUndefined();

    await channel.close();
  });

  it("rejects redeclaring the queue with a mismatched argument", async () => {
    const channel = await rabbitmq.connectionModel.createChannel();

    // The broker closes the channel on a failed assertion, so the 'error' it emits needs an owner.
    channel.on("error", () => {});

    await declareTopology(channel);

    await expect(channel.assertQueue(AMQP_TOPOLOGY.queue, { durable: true })).rejects.toThrow(
      /PRECONDITION_FAILED/,
    );
  });
});
