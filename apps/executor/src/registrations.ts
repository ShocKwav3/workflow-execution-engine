import { AmqpConnection } from "@workflow-engine/core/amqp/AmqpConnection.js";
import { loadAmqpConnectionConfig } from "@workflow-engine/core/amqp/config.js";
import { RabbitMqMessageConsumer } from "@workflow-engine/core/amqp/RabbitMqMessageConsumer.js";
import {
  amqpConnectionConfigToken,
  amqpConnectionToken,
  messageConsumerToken,
} from "@workflow-engine/core/amqp/tokens.js";
import { AMQP_TOPOLOGY } from "@workflow-engine/core/amqp/topology.js";
import { Container } from "@workflow-engine/core/di/container.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { executorConfigToken, loadExecutorConfig } from "./config.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();
  const amqpLogger = createContextLogger(logger, "Amqp");

  container.register(executorConfigToken, loadExecutorConfig, { lifetime: "singleton" });
  container.register(amqpConnectionConfigToken, loadAmqpConnectionConfig, {
    lifetime: "singleton",
  });

  container.register(
    amqpConnectionToken,
    (resolver) => new AmqpConnection(resolver.resolve(amqpConnectionConfigToken), amqpLogger),
    { lifetime: "singleton" },
  );

  container.register(
    messageConsumerToken,
    (resolver) =>
      new RabbitMqMessageConsumer(resolver.resolve(amqpConnectionToken), amqpLogger, {
        queue: AMQP_TOPOLOGY.queue,
        prefetch: resolver.resolve(executorConfigToken).prefetch,
      }),
    { lifetime: "singleton" },
  );

  return container;
}
