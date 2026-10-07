import type { Pool } from "pg";
import { parseInternal } from "@/errors/index.js";
import {
  WORKFLOW_EXECUTION_STATUS,
  workflowExecutionSchema,
} from "@/schemas/workflowExecution.schemas.js";
import { classifyPgError } from "../errors/index.js";
import type { WorkflowExecutionStatusWriter } from "./WorkflowExecutionStatusWriter.js";
import type { WorkflowExecutionRow } from "../types.js";

// Pool-backed: each transition is one autocommitted statement and shares a transaction with nothing.
export class PgWorkflowExecutionStatusWriter implements WorkflowExecutionStatusWriter {
  constructor(private readonly pool: Pool) {}

  // Matches RUNNING too: a redelivered job must be able to resume an execution a lost worker started.
  async markWorkflowExecutionRunning(id: string): Promise<WorkflowExecutionRow | undefined> {
    const executionId = parseInternal(
      workflowExecutionSchema.shape.id,
      id,
      "PgWorkflowExecutionStatusWriter.markWorkflowExecutionRunning",
    );

    try {
      const result = await this.pool.query<WorkflowExecutionRow>(
        `UPDATE workflow_execution SET status = $2, updated_at = now()
         WHERE id = $1 AND status IN ($3, $2)
         RETURNING *`,
        [executionId, WORKFLOW_EXECUTION_STATUS.RUNNING, WORKFLOW_EXECUTION_STATUS.CREATED],
      );

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async markWorkflowExecutionCompleted(id: string): Promise<boolean> {
    const executionId = parseInternal(
      workflowExecutionSchema.shape.id,
      id,
      "PgWorkflowExecutionStatusWriter.markWorkflowExecutionCompleted",
    );

    try {
      const result = await this.pool.query(
        `UPDATE workflow_execution SET status = $2, completed_at = now(), updated_at = now()
         WHERE id = $1 AND status = $3`,
        [executionId, WORKFLOW_EXECUTION_STATUS.COMPLETED, WORKFLOW_EXECUTION_STATUS.RUNNING],
      );

      return result.rowCount === 1;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
