import { loadHealthConfig } from "@/config/healthConfig.js";
import { pgPoolToken } from "@/db/tokens.js";
import type { Container } from "@/di/container.js";
import type { Resolver, Token } from "@/di/types.js";
import { createContextLogger } from "@/logging/contextLogger.js";
import type { Logger } from "@/logging/types.js";
import type { RedisConnection } from "@/redis/RedisConnection.js";
import { DependencyChecker } from "./DependencyChecker.js";
import { DependencyStatusRecord } from "./DependencyStatusRecord.js";
import { RedisDependencyObserver } from "./RedisDependencyObserver.js";
import {
  healthConfigToken,
  postgresCheckerToken,
  postgresStatusToken,
  redisCheckerToken,
  redisObserverToken,
  redisStatusToken,
  workerReadinessToken,
} from "./tokens.js";
import { WorkerReadiness } from "./WorkerReadiness.js";

// Each app owns its Redis connection token, so the app passes it in.
export function registerWorkerHealth(
  container: Container,
  redisConnectionToken: Token<RedisConnection>,
  logger: Logger,
): void {
  container.register(healthConfigToken, loadHealthConfig, { lifetime: "singleton" });

  container.register(
    postgresStatusToken,
    (resolver) =>
      new DependencyStatusRecord({ expiryMs: resolver.resolve(healthConfigToken).resultExpiryMs }),
    { lifetime: "singleton" },
  );

  container.register(
    redisStatusToken,
    (resolver) =>
      new DependencyStatusRecord({ expiryMs: resolver.resolve(healthConfigToken).resultExpiryMs }),
    { lifetime: "singleton" },
  );

  container.register(
    postgresCheckerToken,
    (resolver) => {
      const pool = resolver.resolve(pgPoolToken);
      const { checkIntervalMs, checkTimeoutMs } = resolver.resolve(healthConfigToken);

      return new DependencyChecker(
        resolver.resolve(postgresStatusToken),
        () => pool.query("SELECT 1"),
        { intervalMs: checkIntervalMs, timeoutMs: checkTimeoutMs },
      );
    },
    { lifetime: "singleton" },
  );

  // Skipped while not connected: a PING would wait in ioredis' offline queue until the timeout.
  container.register(
    redisCheckerToken,
    (resolver) => {
      const connection = resolver.resolve(redisConnectionToken);
      const { checkIntervalMs, checkTimeoutMs } = resolver.resolve(healthConfigToken);

      return new DependencyChecker(
        resolver.resolve(redisStatusToken),
        () => connection.client.ping(),
        {
          intervalMs: checkIntervalMs,
          timeoutMs: checkTimeoutMs,
          isConnected: () => connection.isReady(),
        },
      );
    },
    { lifetime: "singleton" },
  );

  // The checker is resolved here, not in the callback: a ready event can arrive after disposal.
  container.register(
    redisObserverToken,
    (resolver) => {
      const checker = resolver.resolve(redisCheckerToken);

      return new RedisDependencyObserver(
        resolver.resolve(redisConnectionToken).client,
        resolver.resolve(redisStatusToken),
        () => checker.requestCheck(),
      );
    },
    { lifetime: "singleton" },
  );

  container.register(
    workerReadinessToken,
    (resolver) =>
      new WorkerReadiness(
        {
          postgres: resolver.resolve(postgresStatusToken),
          redis: resolver.resolve(redisStatusToken),
        },
        createContextLogger(logger, "Health"),
      ),
    { lifetime: "singleton" },
  );
}

export function startDependencyChecks(resolver: Resolver): void {
  resolver.resolve(redisObserverToken).subscribe();
  resolver.resolve(postgresCheckerToken).start();
  resolver.resolve(redisCheckerToken).start();
}
