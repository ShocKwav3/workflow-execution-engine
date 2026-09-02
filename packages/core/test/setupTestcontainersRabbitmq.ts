import { RabbitMQContainer } from "@testcontainers/rabbitmq";

export default async function setup() {
  const rabbitmqContainer = await new RabbitMQContainer(
    `rabbitmq:${process.env.RABBITMQ_VERSION ?? "4.3"}`,
  ).start();

  process.env.TEST_RABBITMQ_URL = rabbitmqContainer.getAmqpUrl();

  return async () => {
    await rabbitmqContainer.stop();
  };
}
