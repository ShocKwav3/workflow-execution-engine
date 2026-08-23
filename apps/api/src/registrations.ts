import type { FastifyBaseLogger } from "fastify";
import { Container } from "./di/container.js";
import { loadPgPoolConfig } from "./db/config.js";
import { createPgPool } from "./db/pool.js";
import { createContextLogger } from "./logging/contextLogger.js";
import {
  pgPoolToken,
  workflowRepositoryToken,
  nodeRepositoryToken,
  workflowExecutionRepositoryToken,
  nodeExecutionRepositoryToken,
} from "./db/tokens.js";
import { WorkflowRepository } from "./db/workflowRepository.js";
import { NodeRepository } from "./db/nodeRepository.js";
import { WorkflowExecutionRepository } from "./db/workflowExecutionRepository.js";
import { NodeExecutionRepository } from "./db/nodeExecutionRepository.js";

export function buildContainer(logger: FastifyBaseLogger): Container {
  const container = new Container();
  const dbLogger = createContextLogger(logger, "Database");

  container.register(pgPoolToken, () => createPgPool(loadPgPoolConfig(), dbLogger), "singleton");

  container.register(
    workflowRepositoryToken,
    (resolver) => new WorkflowRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    nodeRepositoryToken,
    (resolver) => new NodeRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    workflowExecutionRepositoryToken,
    (resolver) => new WorkflowExecutionRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    nodeExecutionRepositoryToken,
    (resolver) => new NodeExecutionRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  return container;
}
