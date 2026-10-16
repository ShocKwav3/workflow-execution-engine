import { Container } from "@workflow-engine/core/di/container.js";
import { loadRedisConfig } from "@workflow-engine/core/config/redisConfig.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { closePgPool, createPgPool } from "@workflow-engine/core/db/pool.js";
import { PgNodeExecutionReader } from "@workflow-engine/core/db/nodeExecution/PgNodeExecutionReader.js";
import { PgNodeExecutionWriter } from "@workflow-engine/core/db/nodeExecution/PgNodeExecutionWriter.js";
import {
  nodeExecutionReaderToken,
  nodeExecutionUnitOfWorkToken,
  pgPoolConfigToken,
  pgPoolToken,
  workflowExecutionStatusWriterToken,
} from "@workflow-engine/core/db/tokens.js";
import { createTransactionRunner } from "@workflow-engine/core/db/transaction.js";
import { PgWorkflowExecutionStatusWriter } from "@workflow-engine/core/db/workflowExecution/PgWorkflowExecutionStatusWriter.js";
import { loadHealthConfig } from "@workflow-engine/core/config/healthConfig.js";
import { DependencyChecker } from "@workflow-engine/core/health/DependencyChecker.js";
import { DependencyStatusRecord } from "@workflow-engine/core/health/DependencyStatusRecord.js";
import { RedisDependencyObserver } from "@workflow-engine/core/health/RedisDependencyObserver.js";
import {
  healthConfigToken,
  postgresCheckerToken,
  postgresStatusToken,
  redisCheckerToken,
  redisObserverToken,
  redisStatusToken,
  workerReadinessToken,
} from "@workflow-engine/core/health/tokens.js";
import { WorkerReadiness } from "@workflow-engine/core/health/WorkerReadiness.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import { loadExecutorConfig } from "./config.js";
import { BullMqConsumer } from "./queue/BullMqConsumer.js";
import { WorkflowExecutionJobHandler } from "./queue/WorkflowExecutionJobHandler.js";
import { SimulatedNodeWork } from "./run/SimulatedNodeWork.js";
import { WorkflowExecutionRunner } from "./run/WorkflowExecutionRunner.js";
import {
  executorConfigToken,
  nodeWorkToken,
  redisConfigToken,
  redisConnectionToken,
  workflowExecutionConsumerToken,
  workflowExecutionJobHandlerToken,
  workflowExecutionRunnerToken,
} from "./tokens.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();

  container.register(executorConfigToken, loadExecutorConfig, { lifetime: "singleton" });

  container.register(redisConfigToken, loadRedisConfig, { lifetime: "singleton" });

  container.register(pgPoolConfigToken, loadPgPoolConfig, { lifetime: "singleton" });

  container.register(
    pgPoolToken,
    (resolver) =>
      createPgPool(resolver.resolve(pgPoolConfigToken), createContextLogger(logger, "Database")),
    { lifetime: "singleton", dispose: closePgPool },
  );

  container.register(
    workflowExecutionStatusWriterToken,
    (resolver) => new PgWorkflowExecutionStatusWriter(resolver.resolve(pgPoolToken)),
    { lifetime: "singleton" },
  );

  container.register(
    nodeExecutionUnitOfWorkToken,
    (resolver) =>
      createTransactionRunner(resolver.resolve(pgPoolToken), (client) => ({
        nodeExecutions: new PgNodeExecutionWriter(client),
      })),
    { lifetime: "singleton" },
  );

  container.register(
    nodeExecutionReaderToken,
    (resolver) => new PgNodeExecutionReader(resolver.resolve(pgPoolToken)),
    { lifetime: "singleton" },
  );

  // A Worker needs maxRetriesPerRequest null and no command timeout: its blocking reads wait indefinitely.
  container.register(
    redisConnectionToken,
    (resolver) =>
      new RedisConnection(
        { url: resolver.resolve(redisConfigToken).url, maxRetriesPerRequest: null },
        createContextLogger(logger, "Redis"),
      ),
    { lifetime: "singleton" },
  );

  container.register(
    nodeWorkToken,
    () => new SimulatedNodeWork(createContextLogger(logger, "NodeWork")),
    { lifetime: "singleton" },
  );

  container.register(
    workflowExecutionRunnerToken,
    (resolver) =>
      new WorkflowExecutionRunner(
        resolver.resolve(workflowExecutionStatusWriterToken),
        resolver.resolve(nodeExecutionUnitOfWorkToken),
        resolver.resolve(nodeExecutionReaderToken),
        resolver.resolve(nodeWorkToken),
        createContextLogger(logger, "Runner"),
      ),
    { lifetime: "singleton" },
  );

  container.register(
    workflowExecutionJobHandlerToken,
    (resolver) =>
      new WorkflowExecutionJobHandler(
        resolver.resolve(workflowExecutionRunnerToken),
        createContextLogger(logger, "WorkflowExecutionJobs"),
      ),
    { lifetime: "singleton" },
  );

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
      new WorkerReadiness({
        postgres: resolver.resolve(postgresStatusToken),
        redis: resolver.resolve(redisStatusToken),
      }),
    { lifetime: "singleton" },
  );

  // Resolved last, so disposed first: the worker finishes its active job before the pools close.
  container.register(
    workflowExecutionConsumerToken,
    (resolver) =>
      new BullMqConsumer(
        resolver.resolve(redisConnectionToken),
        resolver.resolve(workflowExecutionJobHandlerToken),
        { concurrency: resolver.resolve(executorConfigToken).concurrency },
        createContextLogger(logger, "Consumer"),
      ),
    { lifetime: "singleton" },
  );

  return container;
}
