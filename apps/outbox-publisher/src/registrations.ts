import type { Logger } from "@workflow-engine/core/logging/types.js";
import { Container } from "@workflow-engine/core/di/container.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { closePgPool, createPgPool } from "@workflow-engine/core/db/pool.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import {
  outboxRelayToken,
  pgPoolConfigToken,
  pgPoolToken,
} from "@workflow-engine/core/db/tokens.js";
import { PgOutboxRelay } from "@workflow-engine/core/db/outbox/PgOutboxRelay.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();
  const dbLogger = createContextLogger(logger, "Database");

  container.register(pgPoolConfigToken, loadPgPoolConfig, { lifetime: "singleton" });

  container.register(
    pgPoolToken,
    (resolver) => createPgPool(resolver.resolve(pgPoolConfigToken), dbLogger),
    { lifetime: "singleton", dispose: closePgPool },
  );

  container.register(
    outboxRelayToken,
    (resolver) => new PgOutboxRelay(resolver.resolve(pgPoolToken)),
    { lifetime: "singleton" },
  );

  return container;
}
