import type { Pool } from "pg";
import { parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import { type WorkflowVersionRef, workflowVersionRefSchema } from "./workflowVersion.schemas.js";
import type { WorkflowVersionReader } from "./WorkflowVersionReader.js";
import type { WorkflowVersionRow } from "../types.js";

export class PgWorkflowVersionReader implements WorkflowVersionReader {
  constructor(private readonly pool: Pool) {}

  async getWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    const { workflowId, version: versionId } = parseInternal(
      workflowVersionRefSchema,
      input,
      "PgWorkflowVersionReader.getWorkflowVersion",
    );

    try {
      const result = await this.pool.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND id = $2`,
        [workflowId, versionId],
      );

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
