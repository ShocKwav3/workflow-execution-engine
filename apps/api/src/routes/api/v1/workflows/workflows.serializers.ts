import type { WorkflowRow, WorkflowVersionRow } from "../../../../db/types.js";

export function toWorkflowResponse(row: WorkflowRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toWorkflowVersionResponse(row: WorkflowVersionRow) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    definition: row.definition,
    createdAt: row.created_at.toISOString(),
  };
}
