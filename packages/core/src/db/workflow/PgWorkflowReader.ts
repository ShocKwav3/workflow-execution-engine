import type { Pool } from "pg";
import { parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import { workflowIdSchema } from "./workflow.schemas.js";
import type { WorkflowReader } from "./WorkflowReader.js";
import type { WorkflowRow } from "../types.js";

export class PgWorkflowReader implements WorkflowReader {
  constructor(private readonly pool: Pool) {}

  async getWorkflowById(id: string): Promise<WorkflowRow | undefined> {
    const validId = parseInternal(workflowIdSchema, id, "PgWorkflowReader.getWorkflowById");

    try {
      const result = await this.pool.query<WorkflowRow>(`SELECT * FROM workflow WHERE id = $1`, [
        validId,
      ]);

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async listWorkflows(): Promise<WorkflowRow[]> {
    try {
      const result = await this.pool.query<WorkflowRow>(
        `SELECT * FROM workflow ORDER BY created_at`,
      );

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
