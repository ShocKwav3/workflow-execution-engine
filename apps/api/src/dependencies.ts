import { Container } from "./di/container.js";
import { loadPgPoolConfig } from "./db/config.js";
import { createPgPool, pgPoolToken } from "./db/pool.js";
import {
  workflowRepositoryToken,
  workflowExecutionRepositoryToken,
  stepExecutionRepositoryToken,
} from "./db/tokens.js";
import { WorkflowRepository } from "./db/workflowRepository.js";
import { WorkflowExecutionRepository } from "./db/workflowExecutionRepository.js";
import { StepExecutionRepository } from "./db/stepExecutionRepository.js";

export function buildContainer(): Container {
  const container = new Container();

  container.register(pgPoolToken, () => createPgPool(loadPgPoolConfig()), "singleton");

  container.register(
    workflowRepositoryToken,
    (resolver) => new WorkflowRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    workflowExecutionRepositoryToken,
    (resolver) => new WorkflowExecutionRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    stepExecutionRepositoryToken,
    (resolver) => new StepExecutionRepository(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  return container;
}
