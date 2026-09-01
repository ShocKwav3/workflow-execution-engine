import type { Logger } from "@workflow-engine/core/logging/types.js";
import { Container } from "@workflow-engine/core/di/container.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { createPgPool } from "@workflow-engine/core/db/pool.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import {
  pgPoolToken,
  workflowRepositoryToken,
  nodeRepositoryToken,
  workflowExecutionRepositoryToken,
  nodeExecutionRepositoryToken,
} from "@workflow-engine/core/db/tokens.js";
import { WorkflowRepository } from "@workflow-engine/core/db/workflowRepository.js";
import { NodeRepository } from "@workflow-engine/core/db/nodeRepository.js";
import { WorkflowExecutionRepository } from "@workflow-engine/core/db/workflowExecutionRepository.js";
import { NodeExecutionRepository } from "@workflow-engine/core/db/nodeExecutionRepository.js";

export function buildContainer(logger: Logger): Container {
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
