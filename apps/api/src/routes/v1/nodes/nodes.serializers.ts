import type { NodeRow } from "@/db/types.js";

export function toNodeResponse(row: NodeRow) {
  return {
    id: row.id,
    workflowVersionId: row.workflow_version_id,
    name: row.name,
    type: row.type,
    sequence: row.sequence,
    createdAt: row.created_at.toISOString(),
  };
}
