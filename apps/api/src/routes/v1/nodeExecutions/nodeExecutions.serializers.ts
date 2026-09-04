import type { NodeExecutionAttemptRow, NodeExecutionRow } from "@workflow-engine/core/db/types.js";
import type { NodeExecutionHistoryEntry } from "@workflow-engine/core/db/nodeExecution/executionHistoryGrouping.js";

export function toNodeExecutionListItemResponse(row: NodeExecutionRow) {
  return {
    id: row.id,
    workflowExecutionId: row.workflow_execution_id,
    nodeId: row.node_id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toNodeExecutionAttemptResponse(row: NodeExecutionAttemptRow) {
  return {
    id: row.id,
    nodeExecutionId: row.node_execution_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    error: row.error,
  };
}

export function toNodeExecutionDetailResponse(entry: NodeExecutionHistoryEntry) {
  return {
    id: entry.node.id,
    workflowExecutionId: entry.node.workflow_execution_id,
    nodeId: entry.node.node_id,
    name: entry.node.name,
    type: entry.node.type,
    sequence: entry.node.sequence,
    status: entry.node.status,
    createdAt: entry.node.created_at.toISOString(),
    updatedAt: entry.node.updated_at.toISOString(),
    attempts: entry.attempts.map(toNodeExecutionAttemptResponse),
  };
}
