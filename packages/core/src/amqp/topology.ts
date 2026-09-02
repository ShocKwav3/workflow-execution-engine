import type { Channel, ConfirmChannel } from "amqplib";

export const AMQP_TOPOLOGY = {
  exchange: "workflow.commands",
  queue: "workflow.execution.start",
  routingKey: "workflow.execution.start",
} as const;

export async function declareTopology(channel: Channel | ConfirmChannel): Promise<void> {
  await channel.assertExchange(AMQP_TOPOLOGY.exchange, "direct", { durable: true });

  await channel.assertQueue(AMQP_TOPOLOGY.queue, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });

  await channel.bindQueue(AMQP_TOPOLOGY.queue, AMQP_TOPOLOGY.exchange, AMQP_TOPOLOGY.routingKey);
}
