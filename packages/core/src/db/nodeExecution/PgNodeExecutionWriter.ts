import type { PoolClient } from "pg";
import { parseInternal } from "@/errors/index.js";
import {
  NODE_EXECUTION_ATTEMPT_STATUS,
  NODE_EXECUTION_STATUS,
  nodeExecutionAttemptSchema,
  nodeExecutionSchema,
} from "@/schemas/nodeExecution.schemas.js";
import { classifyPgError } from "../errors/index.js";
import type { NodeExecutionWriter } from "./NodeExecutionWriter.js";
import type { NodeExecutionAttemptRow } from "../types.js";

export class PgNodeExecutionWriter implements NodeExecutionWriter {
  constructor(private readonly client: PoolClient) {}

  async abandonRunningAttempts(nodeExecutionId: string): Promise<number> {
    const id = parseInternal(
      nodeExecutionSchema.shape.id,
      nodeExecutionId,
      "PgNodeExecutionWriter.abandonRunningAttempts",
    );

    try {
      const result = await this.client.query(
        `UPDATE node_execution_attempt SET status = $2, finished_at = now(), error = $4
         WHERE node_execution_id = $1 AND status = $3`,
        [
          id,
          NODE_EXECUTION_ATTEMPT_STATUS.ABANDONED,
          NODE_EXECUTION_ATTEMPT_STATUS.RUNNING,
          "worker lost before the attempt finished",
        ],
      );

      return result.rowCount ?? 0;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  // Two concurrent callers can compute the same number; the unique constraint rejects the second.
  async createAttempt(nodeExecutionId: string): Promise<NodeExecutionAttemptRow> {
    const id = parseInternal(
      nodeExecutionSchema.shape.id,
      nodeExecutionId,
      "PgNodeExecutionWriter.createAttempt",
    );

    try {
      const result = await this.client.query<NodeExecutionAttemptRow>(
        `INSERT INTO node_execution_attempt (node_execution_id, attempt_number, status, started_at)
         SELECT $1, COALESCE(MAX(attempt_number), 0) + 1, $2, now()
         FROM node_execution_attempt
         WHERE node_execution_id = $1
         RETURNING *`,
        [id, NODE_EXECUTION_ATTEMPT_STATUS.RUNNING],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async markNodeExecutionRunning(nodeExecutionId: string): Promise<boolean> {
    const id = parseInternal(
      nodeExecutionSchema.shape.id,
      nodeExecutionId,
      "PgNodeExecutionWriter.markNodeExecutionRunning",
    );

    try {
      const result = await this.client.query(
        `UPDATE node_execution SET status = $2, updated_at = now()
         WHERE id = $1 AND status IN ($3, $2)`,
        [id, NODE_EXECUTION_STATUS.RUNNING, NODE_EXECUTION_STATUS.PENDING],
      );

      return result.rowCount === 1;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async completeAttempt(attemptId: string): Promise<boolean> {
    const id = parseInternal(
      nodeExecutionAttemptSchema.shape.id,
      attemptId,
      "PgNodeExecutionWriter.completeAttempt",
    );

    try {
      const result = await this.client.query(
        `UPDATE node_execution_attempt SET status = $2, finished_at = now()
         WHERE id = $1 AND status = $3`,
        [id, NODE_EXECUTION_ATTEMPT_STATUS.COMPLETED, NODE_EXECUTION_ATTEMPT_STATUS.RUNNING],
      );

      return result.rowCount === 1;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async markNodeExecutionCompleted(nodeExecutionId: string): Promise<boolean> {
    const id = parseInternal(
      nodeExecutionSchema.shape.id,
      nodeExecutionId,
      "PgNodeExecutionWriter.markNodeExecutionCompleted",
    );

    try {
      const result = await this.client.query(
        `UPDATE node_execution SET status = $2, updated_at = now()
         WHERE id = $1 AND status = $3`,
        [id, NODE_EXECUTION_STATUS.COMPLETED, NODE_EXECUTION_STATUS.RUNNING],
      );

      return result.rowCount === 1;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
