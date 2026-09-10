import { loadAmqpConnectionConfig } from "@workflow-engine/core/amqp/config.js";
import { RabbitMqMessagePublisher } from "@workflow-engine/core/amqp/RabbitMqMessagePublisher.js";
import {
  amqpConnectionConfigToken,
  messagePublisherToken,
} from "@workflow-engine/core/amqp/tokens.js";
import { Container } from "@workflow-engine/core/di/container.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { closePgPool, createPgPool } from "@workflow-engine/core/db/pool.js";
import {
  outboxClaimerToken,
  pgPoolConfigToken,
  pgPoolToken,
} from "@workflow-engine/core/db/tokens.js";
import { PgOutboxClaimer } from "@workflow-engine/core/db/outbox/PgOutboxClaimer.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();
  const dbLogger = createContextLogger(logger, "Database");
  const amqpLogger = createContextLogger(logger, "Amqp");

  container.register(pgPoolConfigToken, loadPgPoolConfig, { lifetime: "singleton" });
  container.register(amqpConnectionConfigToken, loadAmqpConnectionConfig, {
    lifetime: "singleton",
  });

  container.register(
    pgPoolToken,
    (resolver) => createPgPool(resolver.resolve(pgPoolConfigToken), dbLogger),
    { lifetime: "singleton", dispose: closePgPool },
  );

  container.register(
    outboxClaimerToken,
    (resolver) => new PgOutboxClaimer(resolver.resolve(pgPoolToken)),
    { lifetime: "singleton" },
  );

  container.register(
    messagePublisherToken,
    (resolver) =>
      new RabbitMqMessagePublisher(resolver.resolve(amqpConnectionConfigToken), amqpLogger),
    { lifetime: "singleton" },
  );

  return container;
}
