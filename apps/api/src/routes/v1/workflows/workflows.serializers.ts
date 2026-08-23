import type { WorkflowRow } from "../../../db/types.js";

export function toWorkflowResponse(row: WorkflowRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
