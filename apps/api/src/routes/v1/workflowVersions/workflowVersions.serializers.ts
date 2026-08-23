import type { WorkflowVersionRow } from "../../../db/types.js";

export function toWorkflowVersionResponse(row: WorkflowVersionRow) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
  };
}
