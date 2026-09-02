import type { ChannelModel } from "amqplib";
import { closeAmqpConnection, createAmqpConnection } from "@/amqp/connection.js";
import { requireEnv } from "@/config/env.js";
import type { Logger } from "@/logging/types.js";

export const testLogger: Logger = {
  child: () => testLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

export interface TestRabbitmqConnection {
  url: string;
}

export interface TestRabbitmq {
  connection: TestRabbitmqConnection;
  connectionModel: ChannelModel;
}

// One shared RabbitMQ container for the whole run (see globalSetup.ts).
export async function startTestRabbitmq(): Promise<TestRabbitmq> {
  const connection: TestRabbitmqConnection = {
    url: requireEnv("TEST_RABBITMQ_URL", "is globalSetup wired up?"),
  };
  const connectionModel = await createAmqpConnection(connection, testLogger);

  return { connection, connectionModel };
}

export async function stopTestRabbitmq(rabbitmq: TestRabbitmq): Promise<void> {
  await closeAmqpConnection(rabbitmq.connectionModel);
}
