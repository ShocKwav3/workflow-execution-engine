import amqplib, { type ChannelModel } from "amqplib";
import type { Logger } from "../logging/types.js";
import type { AmqpConnectionConfig } from "./config.js";

export async function createAmqpConnection(
  config: AmqpConnectionConfig,
  logger: Logger,
): Promise<ChannelModel> {
  const connection = await amqplib.connect(config.url);

  connection.on("error", (err) => {
    logger.error({ err }, "unexpected error on AMQP connection");
  });

  connection.on("close", (err) => {
    logger.warn({ err }, "AMQP connection closed");
  });

  return connection;
}

export async function closeAmqpConnection(connection: ChannelModel): Promise<void> {
  await connection.close();
}
