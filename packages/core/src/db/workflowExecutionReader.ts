import type { Pool } from "pg";
import { classifyPgError } from "./errors/index.js";
import { executionIdSchema } from "./workflowExecution.schemas.js";
import type { WorkflowExecutionRow } from "./types.js";

export interface WorkflowExecutionReader {
  getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined>;
}

export class PgWorkflowExecutionReader implements WorkflowExecutionReader {
  constructor(private readonly pool: Pool) {}

  async getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined> {
    const validId = executionIdSchema.parse(id);

    try {
      const result = await this.pool.query<WorkflowExecutionRow>(
        `SELECT * FROM workflow_execution WHERE id = $1`,
        [validId],
      );

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
