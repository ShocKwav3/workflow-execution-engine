import { Container } from "@workflow-engine/core/di/container.js";
import { loadRedisConfig } from "@workflow-engine/core/config/redisConfig.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { closePgPool, createPgPool } from "@workflow-engine/core/db/pool.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import {
  outboxRelayToken,
  pgPoolConfigToken,
  pgPoolToken,
} from "@workflow-engine/core/db/tokens.js";
import { PgOutboxRelay } from "@workflow-engine/core/db/outbox/PgOutboxRelay.js";
import { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import { loadOutboxPublisherConfig } from "./config.js";
import { BullMqJobQueue } from "./queue/BullMqJobQueue.js";
import {
  jobQueueToken,
  outboxPublisherConfigToken,
  redisConfigToken,
  redisConnectionToken,
} from "./tokens.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();

  container.register(outboxPublisherConfigToken, loadOutboxPublisherConfig, {
    lifetime: "singleton",
  });

  container.register(redisConfigToken, loadRedisConfig, { lifetime: "singleton" });

  container.register(pgPoolConfigToken, loadPgPoolConfig, { lifetime: "singleton" });

  container.register(
    pgPoolToken,
    (resolver) =>
      createPgPool(resolver.resolve(pgPoolConfigToken), createContextLogger(logger, "Database")),
    { lifetime: "singleton", dispose: closePgPool },
  );

  container.register(
    outboxRelayToken,
    (resolver) => new PgOutboxRelay(resolver.resolve(pgPoolToken)),
    { lifetime: "singleton" },
  );

  // A producer fails fast while Redis is down, and the publish timeout bounds a stalled command.
  container.register(
    redisConnectionToken,
    (resolver) =>
      new RedisConnection(
        {
          url: resolver.resolve(redisConfigToken).url,
          enableOfflineQueue: false,
          commandTimeoutMs: resolver.resolve(outboxPublisherConfigToken).publishTimeoutMs,
        },
        createContextLogger(logger, "Redis"),
      ),
    { lifetime: "singleton" },
  );

  container.register(
    jobQueueToken,
    (resolver) => new BullMqJobQueue(resolver.resolve(redisConnectionToken)),
    { lifetime: "singleton" },
  );

  return container;
}
