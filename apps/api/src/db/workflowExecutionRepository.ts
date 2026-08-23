import type { Pool } from "pg";
import { VersionNotPublishedError, WorkflowVersionMismatchError } from "../errors/domain/index.js";
import { ClassifiedError } from "../errors/index.js";
import { classifyPgError } from "./errors/index.js";
import {
  type CreateExecutionInput,
  createExecutionInputSchema,
  executionIdSchema,
} from "./workflowExecutionRepository.schemas.js";
import type { NodeRow, WorkflowExecutionRow, WorkflowVersionRow } from "./types.js";

export class WorkflowExecutionRepository {
  constructor(private readonly pool: Pool) {}

  // Only transactional write here — a repeated idempotency key returns the existing execution.
  async createWorkflowExecution(input: CreateExecutionInput): Promise<WorkflowExecutionRow> {
    const { workflowId, workflowVersionId, idempotencyKey } =
      createExecutionInputSchema.parse(input);

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // FOR SHARE blocks a concurrent publish/node write without blocking other executions.
      const versionResult = await client.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE id = $1 AND workflow_id = $2 FOR SHARE`,
        [workflowVersionId, workflowId],
      );
      const workflowVersion = versionResult.rows[0];

      if (!workflowVersion) {
        throw new WorkflowVersionMismatchError({ workflowId, workflowVersionId });
      }

      if (workflowVersion.status !== "PUBLISHED") {
        throw new VersionNotPublishedError(workflowVersion.version, {
          workflowId,
          workflowVersionId,
        });
      }

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

      const nodesResult = await client.query<NodeRow>(
        `SELECT * FROM node WHERE workflow_version_id = $1 ORDER BY sequence`,
        [workflowVersionId],
      );

      for (const node of nodesResult.rows) {
        await client.query(
          `INSERT INTO node_execution (workflow_execution_id, node_id) VALUES ($1, $2)`,
          [execution.id, node.id],
        );
      }

      await client.query("COMMIT");

      return execution;
    } catch (error) {
      await client.query("ROLLBACK");

      if (error instanceof ClassifiedError) {
        throw error;
      }

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
