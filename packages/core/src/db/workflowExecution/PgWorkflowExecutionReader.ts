import type { Pool } from "pg";
import { parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import { executionIdSchema } from "./workflowExecution.schemas.js";
import type { WorkflowExecutionReader } from "./WorkflowExecutionReader.js";
import type { WorkflowExecutionRow } from "../types.js";

export class PgWorkflowExecutionReader implements WorkflowExecutionReader {
  constructor(private readonly pool: Pool) {}

  async getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined> {
    const validId = parseInternal(
      executionIdSchema,
      id,
      "PgWorkflowExecutionReader.getWorkflowExecutionById",
    );

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
