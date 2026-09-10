import amqplib, { type ChannelModel } from "amqplib";
import { requireEnv } from "@/config/env.js";

export interface TestRabbitmq {
  url: string;
  connectionModel: ChannelModel;
}

// One shared RabbitMQ container for the whole run (see globalSetup.ts).
export async function startTestRabbitmq(): Promise<TestRabbitmq> {
  const url = requireEnv("TEST_RABBITMQ_URL", "is globalSetup wired up?");

  return { url, connectionModel: await amqplib.connect(url) };
}

export async function stopTestRabbitmq(rabbitmq: TestRabbitmq): Promise<void> {
  await rabbitmq.connectionModel.close();
}
