import type { Pool } from "pg";
import { NodeRepository } from "../src/db/nodeRepository.js";
import { WorkflowRepository } from "../src/db/workflowRepository.js";
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

export async function seedDraftVersion(
  pool: Pool,
  definition: NodeDefinition[],
  workflowName = "Order Fulfillment",
): Promise<SeededVersion> {
  const workflows = new WorkflowRepository(pool);
  const nodes = new NodeRepository(pool);
  const workflow = await workflows.createWorkflow({ name: workflowName });
  const version = await workflows.createWorkflowVersion({ workflowId: workflow.id, version: 1 });

  for (const node of definition) {
    await nodes.createNode({ workflowId: workflow.id, version: 1, ...node });
  }

  const created = await nodes.listNodesForVersion({ workflowId: workflow.id, version: 1 });

  return { workflow, version, nodes: created ?? [] };
}

export async function seedPublishedVersion(
  pool: Pool,
  definition: NodeDefinition[],
  workflowName = "Order Fulfillment",
): Promise<SeededVersion> {
  const workflows = new WorkflowRepository(pool);
  const seeded = await seedDraftVersion(pool, definition, workflowName);
  const published = await workflows.publishWorkflowVersion({
    workflowId: seeded.workflow.id,
    version: 1,
  });

  return { ...seeded, version: published! };
}
