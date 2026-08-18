import type { WorkflowRepository } from "../workflowRepository.js";

const DEFAULT_DEFINITION = [
  { name: "Reserve Inventory", type: "inventory" },
  { name: "Charge Payment", type: "payment" },
];

export async function createWorkflowWithVersion(
  workflowRepo: WorkflowRepository,
  definition = DEFAULT_DEFINITION,
) {
  const workflow = await workflowRepo.createWorkflow({ name: "Order Fulfillment" });
  const version = await workflowRepo.createWorkflowVersion({
    workflowId: workflow.id,
    version: 1,
    definition,
  });

  return { workflow, version, definition };
}
