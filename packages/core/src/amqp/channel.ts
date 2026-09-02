import type { Channel, ChannelModel, ConfirmChannel } from "amqplib";
import type { Logger } from "../logging/types.js";

export async function createAmqpChannel(
  connection: ChannelModel,
  logger: Logger,
): Promise<Channel> {
  const channel = await connection.createChannel();

  channel.on("error", (err) => {
    logger.error({ err }, "unexpected error on AMQP channel");
  });

  return channel;
}

export async function createAmqpConfirmChannel(
  connection: ChannelModel,
  logger: Logger,
): Promise<ConfirmChannel> {
  const channel = await connection.createConfirmChannel();

  channel.on("error", (err) => {
    logger.error({ err }, "unexpected error on AMQP confirm channel");
  });

  return channel;
}

export async function closeAmqpChannel(channel: Channel | ConfirmChannel): Promise<void> {
  await channel.close();
}
