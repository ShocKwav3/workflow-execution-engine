import { Container } from "@workflow-engine/core/di/container.js";
import { loadRedisConfig } from "@workflow-engine/core/config/redisConfig.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { closePgPool, createPgPool } from "@workflow-engine/core/db/pool.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import {
  outboxClaimerToken,
  pgPoolConfigToken,
  pgPoolToken,
} from "@workflow-engine/core/db/tokens.js";
import { PgOutboxClaimer } from "@workflow-engine/core/db/outbox/PgOutboxClaimer.js";
import { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import { loadOutboxRelayConfig } from "./config.js";
import { OutboxRelay } from "./OutboxRelay.js";
import { createPoller } from "./poller.js";
import { BullMqJobQueue } from "./queue/BullMqJobQueue.js";
import {
  jobQueueToken,
  outboxRelayConfigToken,
  outboxRelayToken,
  pollerToken,
  redisConfigToken,
  redisConnectionToken,
} from "./tokens.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();

  container.register(outboxRelayConfigToken, loadOutboxRelayConfig, { lifetime: "singleton" });

  container.register(redisConfigToken, loadRedisConfig, { lifetime: "singleton" });

  container.register(pgPoolConfigToken, loadPgPoolConfig, { lifetime: "singleton" });

  container.register(
    pgPoolToken,
    (resolver) =>
      createPgPool(resolver.resolve(pgPoolConfigToken), createContextLogger(logger, "Database")),
    { lifetime: "singleton", dispose: closePgPool },
  );

  container.register(
    outboxClaimerToken,
    (resolver) => new PgOutboxClaimer(resolver.resolve(pgPoolToken)),
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
          commandTimeoutMs: resolver.resolve(outboxRelayConfigToken).publishTimeoutMs,
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

  container.register(
    outboxRelayToken,
    (resolver) =>
      new OutboxRelay(
        resolver.resolve(outboxClaimerToken),
        resolver.resolve(jobQueueToken),
        resolver.resolve(outboxRelayConfigToken),
        createContextLogger(logger, "Relay"),
      ),
    { lifetime: "singleton" },
  );

  // Resolved last, so disposed first: polling stops before the queue and pools close.
  container.register(
    pollerToken,
    (resolver) => {
      const relay = resolver.resolve(outboxRelayToken);
      const { pollIntervalMs, maxBackoffMs } = resolver.resolve(outboxRelayConfigToken);

      return createPoller({
        intervalMs: pollIntervalMs,
        maxBackoffMs,
        logger: createContextLogger(logger, "Poller"),
        tick: () => relay.relayBatch(),
      });
    },
    { lifetime: "singleton", dispose: (poller) => poller.stop() },
  );

  return container;
}
