import type { PoolClient } from "pg";
import { VersionNotPublishedError, WorkflowVersionMismatchError } from "@/errors/domain/index.js";
import { ClassifiedError, parseInternal } from "@/errors/index.js";
import {
  WORKFLOW_EXECUTION_STATUS,
  workflowExecutionSchema,
} from "@/schemas/workflowExecution.schemas.js";
import { WORKFLOW_VERSION_STATUS } from "@/schemas/workflowVersion.schemas.js";
import { classifyPgError } from "../errors/index.js";
import {
  type CreateWorkflowExecutionInput,
  createWorkflowExecutionRefSchema,
  idempotencyKeySchema,
} from "./workflowExecution.schemas.js";
import type {
  CreateWorkflowExecutionResult,
  WorkflowExecutionWriter,
} from "./WorkflowExecutionWriter.js";
import type { NodeRow, WorkflowExecutionRow, WorkflowVersionRow } from "../types.js";

export class PgWorkflowExecutionWriter implements WorkflowExecutionWriter {
  constructor(private readonly client: PoolClient) {}

  async createWorkflowExecution(
    input: CreateWorkflowExecutionInput,
  ): Promise<CreateWorkflowExecutionResult> {
    const { workflowId, workflowVersionId } = parseInternal(
      createWorkflowExecutionRefSchema,
      input,
      "PgWorkflowExecutionWriter.createWorkflowExecution",
    );
    const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);

    try {
      // FOR SHARE blocks a concurrent publish/node write without blocking other executions.
      const versionResult = await this.client.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE id = $1 AND workflow_id = $2 FOR SHARE`,
        [workflowVersionId, workflowId],
      );
      const workflowVersion = versionResult.rows[0];

      if (!workflowVersion) {
        throw new WorkflowVersionMismatchError({ workflowId, workflowVersionId });
      }

      if (workflowVersion.status !== WORKFLOW_VERSION_STATUS.PUBLISHED) {
        throw new VersionNotPublishedError(workflowVersion.version, {
          workflowId,
          workflowVersionId,
        });
      }

      const insertResult = await this.client.query<WorkflowExecutionRow>(
        `INSERT INTO workflow_execution (workflow_id, workflow_version_id, idempotency_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (workflow_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [workflowId, workflowVersionId, idempotencyKey ?? null],
      );

      if (insertResult.rows.length === 0) {
        const existing = await this.client.query<WorkflowExecutionRow>(
          `SELECT * FROM workflow_execution WHERE workflow_id = $1 AND idempotency_key = $2`,
          [workflowId, idempotencyKey],
        );

        return { execution: existing.rows[0]!, created: false };
      }

      const execution = insertResult.rows[0]!;

      const nodesResult = await this.client.query<NodeRow>(
        `SELECT * FROM node WHERE workflow_version_id = $1 ORDER BY sequence`,
        [workflowVersionId],
      );

      for (const node of nodesResult.rows) {
        await this.client.query(
          `INSERT INTO node_execution (workflow_execution_id, node_id) VALUES ($1, $2)`,
          [execution.id, node.id],
        );
      }

      return { execution, created: true };
    } catch (error) {
      if (error instanceof ClassifiedError) {
        throw error;
      }

      throw classifyPgError(error);
    }
  }

  // Matches RUNNING too: a redelivered job must be able to resume an execution a lost worker started.
  async markWorkflowExecutionRunning(id: string): Promise<WorkflowExecutionRow | undefined> {
    const executionId = parseInternal(
      workflowExecutionSchema.shape.id,
      id,
      "PgWorkflowExecutionWriter.markWorkflowExecutionRunning",
    );

    try {
      const result = await this.client.query<WorkflowExecutionRow>(
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
      "PgWorkflowExecutionWriter.markWorkflowExecutionCompleted",
    );

    try {
      const result = await this.client.query(
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
