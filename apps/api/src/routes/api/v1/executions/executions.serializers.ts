import type {
  StepAttemptRow,
  StepExecutionRow,
  WorkflowExecutionRow,
} from "../../../../db/types.js";
import type { StepExecutionHistoryEntry } from "../../../../db/helpers/executionHistoryGrouping.js";

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

export function toStepExecutionResponse(row: StepExecutionRow) {
  return {
    id: row.id,
    workflowExecutionId: row.workflow_execution_id,
    stepName: row.step_name,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toStepAttemptResponse(row: StepAttemptRow) {
  return {
    id: row.id,
    stepExecutionId: row.step_execution_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    error: row.error,
  };
}

export function toWorkflowExecutionHistoryEntryResponse(entry: StepExecutionHistoryEntry) {
  return {
    step: toStepExecutionResponse(entry.step),
    attempts: entry.attempts.map(toStepAttemptResponse),
  };
}
