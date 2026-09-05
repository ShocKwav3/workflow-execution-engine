import type { Pool } from "pg";
import { createTransactionRunner } from "../src/db/transaction.js";
import { PgNodeReader } from "../src/db/node/PgNodeReader.js";
import { PgNodeWriter } from "../src/db/node/PgNodeWriter.js";
import { PgWorkflowWriter } from "../src/db/workflow/PgWorkflowWriter.js";
import { PgWorkflowVersionWriter } from "../src/db/workflowVersion/PgWorkflowVersionWriter.js";
import { PgWorkflowExecutionWriter } from "../src/db/workflowExecution/PgWorkflowExecutionWriter.js";
import { PgOutboxWriter } from "../src/db/outbox/PgOutboxWriter.js";
import { AmqpWorkflowExecutionOutbox } from "../src/db/outbox/AmqpWorkflowExecutionOutbox.js";
import type { NodeRow, WorkflowRow, WorkflowVersionRow } from "../src/db/types.js";

export interface NodeDefinition {
  name: string;
  type: string;
}

export interface SeededVersion {
  workflow: WorkflowRow;
  version: WorkflowVersionRow;
  nodes: NodeRow[];
}

export const workflowUnitOfWorkFor = (pool: Pool) =>
  createTransactionRunner(pool, (client) => ({ workflows: new PgWorkflowWriter(client) }));

export const workflowVersionUnitOfWorkFor = (pool: Pool) =>
  createTransactionRunner(pool, (client) => ({
    workflowVersions: new PgWorkflowVersionWriter(client),
  }));

export const nodeUnitOfWorkFor = (pool: Pool) =>
  createTransactionRunner(pool, (client) => ({ nodes: new PgNodeWriter(client) }));

export const workflowExecutionUnitOfWorkFor = (pool: Pool) =>
  createTransactionRunner(pool, (client) => ({
    workflowExecutions: new PgWorkflowExecutionWriter(client),
    workflowExecutionOutbox: new AmqpWorkflowExecutionOutbox(new PgOutboxWriter(client)),
  }));

export async function seedDraftVersion(
  pool: Pool,
  definition: NodeDefinition[],
  workflowName = "Order Fulfillment",
): Promise<SeededVersion> {
  const workflow = await workflowUnitOfWorkFor(pool).run((scope) =>
    scope.workflows.createWorkflow({ name: workflowName }),
  );
  const version = await workflowVersionUnitOfWorkFor(pool).run((scope) =>
    scope.workflowVersions.createWorkflowVersion({ workflowId: workflow.id, version: 1 }),
  );

  for (const node of definition) {
    await nodeUnitOfWorkFor(pool).run((scope) =>
      scope.nodes.createNode({ workflowId: workflow.id, version: version.id, ...node }),
    );
  }

  const created = await new PgNodeReader(pool).listNodesForVersion({
    workflowId: workflow.id,
    version: version.id,
  });

  return { workflow, version, nodes: created ?? [] };
}

export async function seedPublishedVersion(
  pool: Pool,
  definition: NodeDefinition[],
  workflowName = "Order Fulfillment",
): Promise<SeededVersion> {
  const seeded = await seedDraftVersion(pool, definition, workflowName);
  const published = await workflowVersionUnitOfWorkFor(pool).run((scope) =>
    scope.workflowVersions.publishWorkflowVersion({
      workflowId: seeded.workflow.id,
      version: seeded.version.id,
    }),
  );

  return { ...seeded, version: published! };
}
