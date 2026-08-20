import { classifyPgError } from "./errors/index.js";
import type { Queryable, WorkflowRow, WorkflowVersionRow } from "./types.js";
import {
  type CreateWorkflowInput,
  type CreateWorkflowVersionInput,
  type GetWorkflowVersionInput,
  createWorkflowInputSchema,
  createWorkflowVersionInputSchema,
  getWorkflowVersionInputSchema,
  workflowIdSchema,
} from "./workflowRepository.schemas.js";

export class WorkflowRepository {
  constructor(private readonly db: Queryable) {}

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow> {
    const { name } = createWorkflowInputSchema.parse(input);

    try {
      const result = await this.db.query<WorkflowRow>(
        `INSERT INTO workflow (name) VALUES ($1) RETURNING *`,
        [name],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async getWorkflowById(id: string): Promise<WorkflowRow | undefined> {
    const validId = workflowIdSchema.parse(id);

    try {
      const result = await this.db.query<WorkflowRow>(`SELECT * FROM workflow WHERE id = $1`, [
        validId,
      ]);

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async listWorkflows(): Promise<WorkflowRow[]> {
    try {
      const result = await this.db.query<WorkflowRow>(`SELECT * FROM workflow ORDER BY created_at`);

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async createWorkflowVersion(input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow> {
    const { workflowId, version, definition } = createWorkflowVersionInputSchema.parse(input);

    try {
      const result = await this.db.query<WorkflowVersionRow>(
        `INSERT INTO workflow_version (workflow_id, version, definition)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [workflowId, version, JSON.stringify(definition)],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async getWorkflowVersion(
    input: GetWorkflowVersionInput,
  ): Promise<WorkflowVersionRow | undefined> {
    const { workflowId, version } = getWorkflowVersionInputSchema.parse(input);

    try {
      const result = await this.db.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = $2`,
        [workflowId, version],
      );

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
