import type { Logger } from "@workflow-engine/core/logging/types.js";
import { Container } from "@workflow-engine/core/di/container.js";
import { loadPgPoolConfig } from "@workflow-engine/core/db/config.js";
import { createPgPool } from "@workflow-engine/core/db/pool.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import {
  pgPoolToken,
  workflowReaderToken,
  workflowUnitOfWorkToken,
  workflowVersionReaderToken,
  workflowVersionUnitOfWorkToken,
  nodeReaderToken,
  nodeUnitOfWorkToken,
  workflowExecutionReaderToken,
  workflowExecutionUnitOfWorkToken,
  nodeExecutionReaderToken,
} from "@workflow-engine/core/db/tokens.js";
import { PgWorkflowReader } from "@workflow-engine/core/db/workflow/PgWorkflowReader.js";
import { PgWorkflowWriter } from "@workflow-engine/core/db/workflow/PgWorkflowWriter.js";
import { PgWorkflowVersionReader } from "@workflow-engine/core/db/workflowVersion/PgWorkflowVersionReader.js";
import { PgWorkflowVersionWriter } from "@workflow-engine/core/db/workflowVersion/PgWorkflowVersionWriter.js";
import { PgNodeReader } from "@workflow-engine/core/db/node/PgNodeReader.js";
import { PgNodeWriter } from "@workflow-engine/core/db/node/PgNodeWriter.js";
import { createTransactionRunner } from "@workflow-engine/core/db/transaction.js";
import { PgWorkflowExecutionReader } from "@workflow-engine/core/db/workflowExecution/PgWorkflowExecutionReader.js";
import { PgWorkflowExecutionWriter } from "@workflow-engine/core/db/workflowExecution/PgWorkflowExecutionWriter.js";
import { PgNodeExecutionReader } from "@workflow-engine/core/db/nodeExecution/PgNodeExecutionReader.js";
import {
  workflowServiceToken,
  nodeServiceToken,
  workflowExecutionServiceToken,
  nodeExecutionServiceToken,
} from "@workflow-engine/core/services/tokens.js";
import { WorkflowService } from "@workflow-engine/core/services/workflowService.js";
import { NodeService } from "@workflow-engine/core/services/nodeService.js";
import { WorkflowExecutionService } from "@workflow-engine/core/services/workflowExecutionService.js";
import { NodeExecutionService } from "@workflow-engine/core/services/nodeExecutionService.js";

export function buildContainer(logger: Logger): Container {
  const container = new Container();
  const dbLogger = createContextLogger(logger, "Database");

  container.register(pgPoolToken, () => createPgPool(loadPgPoolConfig(), dbLogger), "singleton");

  container.register(
    workflowReaderToken,
    (resolver) => new PgWorkflowReader(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    workflowUnitOfWorkToken,
    (resolver) =>
      createTransactionRunner(resolver.resolve(pgPoolToken), (client) => ({
        workflows: new PgWorkflowWriter(client),
      })),
    "singleton",
  );

  container.register(
    workflowVersionReaderToken,
    (resolver) => new PgWorkflowVersionReader(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    workflowVersionUnitOfWorkToken,
    (resolver) =>
      createTransactionRunner(resolver.resolve(pgPoolToken), (client) => ({
        workflowVersions: new PgWorkflowVersionWriter(client),
      })),
    "singleton",
  );

  container.register(
    nodeReaderToken,
    (resolver) => new PgNodeReader(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    nodeUnitOfWorkToken,
    (resolver) =>
      createTransactionRunner(resolver.resolve(pgPoolToken), (client) => ({
        nodes: new PgNodeWriter(client),
      })),
    "singleton",
  );

  container.register(
    workflowExecutionReaderToken,
    (resolver) => new PgWorkflowExecutionReader(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    workflowExecutionUnitOfWorkToken,
    (resolver) =>
      createTransactionRunner(resolver.resolve(pgPoolToken), (client) => ({
        workflowExecutions: new PgWorkflowExecutionWriter(client),
      })),
    "singleton",
  );

  container.register(
    nodeExecutionReaderToken,
    (resolver) => new PgNodeExecutionReader(resolver.resolve(pgPoolToken)),
    "singleton",
  );

  container.register(
    workflowServiceToken,
    (resolver) =>
      new WorkflowService(
        resolver.resolve(workflowReaderToken),
        resolver.resolve(workflowUnitOfWorkToken),
        resolver.resolve(workflowVersionReaderToken),
        resolver.resolve(workflowVersionUnitOfWorkToken),
      ),
    "singleton",
  );

  container.register(
    nodeServiceToken,
    (resolver) =>
      new NodeService(resolver.resolve(nodeReaderToken), resolver.resolve(nodeUnitOfWorkToken)),
    "singleton",
  );

  container.register(
    workflowExecutionServiceToken,
    (resolver) =>
      new WorkflowExecutionService(
        resolver.resolve(workflowExecutionReaderToken),
        resolver.resolve(workflowExecutionUnitOfWorkToken),
      ),
    "singleton",
  );

  container.register(
    nodeExecutionServiceToken,
    (resolver) => new NodeExecutionService(resolver.resolve(nodeExecutionReaderToken)),
    "singleton",
  );

  return container;
}
