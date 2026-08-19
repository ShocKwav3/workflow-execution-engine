import type { Pool } from "pg";
import { createToken } from "../di/token.js";
import { classifyPgError } from "./errors.js";
import {
  type CreateExecutionInput,
  createExecutionInputSchema,
  executionIdSchema,
} from "./workflowExecutionRepository.schemas.js";
import type { StepDefinition, WorkflowExecutionRow } from "./types.js";

export const workflowExecutionRepositoryToken = createToken<WorkflowExecutionRepository>(
  "workflowExecutionRepository",
);

export class WorkflowExecutionRepository {
  constructor(private readonly pool: Pool) {}

  // Only transactional write here — a repeated idempotency key returns the existing execution.
  async createWorkflowExecution(input: CreateExecutionInput): Promise<WorkflowExecutionRow> {
    const { workflowId, workflowVersionId, idempotencyKey } =
      createExecutionInputSchema.parse(input);

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const insertResult = await client.query<WorkflowExecutionRow>(
        `INSERT INTO workflow_execution (workflow_id, workflow_version_id, idempotency_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (workflow_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [workflowId, workflowVersionId, idempotencyKey ?? null],
      );

      if (insertResult.rows.length === 0) {
        const existing = await client.query<WorkflowExecutionRow>(
          `SELECT * FROM workflow_execution WHERE workflow_id = $1 AND idempotency_key = $2`,
          [workflowId, idempotencyKey],
        );

        await client.query("COMMIT");

        return existing.rows[0]!;
      }

      const execution = insertResult.rows[0]!;

      const versionResult = await client.query<{ definition: StepDefinition[] }>(
        `SELECT definition FROM workflow_version WHERE id = $1`,
        [workflowVersionId],
      );
      const definition = versionResult.rows[0]!.definition;

      for (const step of definition) {
        await client.query(
          `INSERT INTO step_execution (workflow_execution_id, step_name) VALUES ($1, $2)`,
          [execution.id, step.name],
        );
      }

      await client.query("COMMIT");

      return execution;
    } catch (error) {
      await client.query("ROLLBACK");
      throw classifyPgError(error);
    } finally {
      client.release();
    }
  }

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
