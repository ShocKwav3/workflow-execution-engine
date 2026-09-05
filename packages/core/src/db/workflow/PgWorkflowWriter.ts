import type { PoolClient } from "pg";
import { parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import { type CreateWorkflowInput, createWorkflowInputSchema } from "./workflow.schemas.js";
import type { WorkflowWriter } from "./WorkflowWriter.js";
import type { WorkflowRow } from "../types.js";

export class PgWorkflowWriter implements WorkflowWriter {
  constructor(private readonly client: PoolClient) {}

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow> {
    const { name } = parseInternal(
      createWorkflowInputSchema,
      input,
      "PgWorkflowWriter.createWorkflow",
    );

    try {
      const result = await this.client.query<WorkflowRow>(
        `INSERT INTO workflow (name) VALUES ($1) RETURNING *`,
        [name],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
