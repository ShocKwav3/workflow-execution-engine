import type {
  NodeRow,
  NodeExecutionRow,
  WorkflowExecutionRow,
  WorkflowRow,
} from "../../../../db/types.js";
import type { WorkflowVersionWithNodes } from "../../../../db/workflowRepository.js";

export function toWorkflowResponse(row: WorkflowRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

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

export function toWorkflowVersionResponse(data: WorkflowVersionWithNodes) {
  return {
    id: data.version.id,
    workflowId: data.version.workflow_id,
    version: data.version.version,
    nodes: data.nodes.map(toNodeResponse),
    createdAt: data.version.created_at.toISOString(),
  };
}

export function toWorkflowExecutionResponse(row: WorkflowExecutionRow) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowVersionId: row.workflow_version_id,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

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
