import type { Pool } from "pg";
import {
  VersionAlreadyPublishedError,
  VersionHasNoNodesError,
  VersionNotDraftError,
} from "../errors/domain/index.js";
import { ClassifiedError } from "../errors/index.js";
import { classifyPgError } from "./errors/index.js";
import type { WorkflowRow, WorkflowVersionRow } from "./types.js";
import {
  type CreateWorkflowInput,
  type WorkflowVersionRef,
  createWorkflowInputSchema,
  workflowIdSchema,
  workflowVersionRefSchema,
} from "./workflowRepository.schemas.js";

export class WorkflowRepository {
  constructor(private readonly pool: Pool) {}

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow> {
    const { name } = createWorkflowInputSchema.parse(input);

    try {
      const result = await this.pool.query<WorkflowRow>(
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

  async createWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow> {
    const { workflowId, version } = workflowVersionRefSchema.parse(input);

    try {
      const result = await this.pool.query<WorkflowVersionRow>(
        `INSERT INTO workflow_version (workflow_id, version) VALUES ($1, $2) RETURNING *`,
        [workflowId, version],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async publishWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    const { workflowId, version } = workflowVersionRefSchema.parse(input);

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const locked = await client.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = $2 FOR UPDATE`,
        [workflowId, version],
      );
      const workflowVersion = locked.rows[0];

      if (!workflowVersion) {
        await client.query("ROLLBACK");

        return undefined;
      }

      if (workflowVersion.status !== "DRAFT") {
        throw new VersionAlreadyPublishedError(version, {
          workflowId,
          workflowVersionId: workflowVersion.id,
        });
      }

      const nodeCount = await client.query<{ count: string }>(
        `SELECT count(*) AS count FROM node WHERE workflow_version_id = $1`,
        [workflowVersion.id],
      );

      if (Number(nodeCount.rows[0]!.count) === 0) {
        throw new VersionHasNoNodesError(version, {
          workflowId,
          workflowVersionId: workflowVersion.id,
        });
      }

      const published = await client.query<WorkflowVersionRow>(
        `UPDATE workflow_version SET status = 'PUBLISHED', published_at = now()
         WHERE id = $1
         RETURNING *`,
        [workflowVersion.id],
      );

      await client.query("COMMIT");

      return published.rows[0]!;
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

  async deleteWorkflowVersion(input: WorkflowVersionRef): Promise<boolean> {
    const { workflowId, version } = workflowVersionRefSchema.parse(input);

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const locked = await client.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = $2 FOR UPDATE`,
        [workflowId, version],
      );
      const workflowVersion = locked.rows[0];

      if (!workflowVersion) {
        await client.query("ROLLBACK");

        return false;
      }

      if (workflowVersion.status !== "DRAFT") {
        throw new VersionNotDraftError(version, {
          workflowId,
          workflowVersionId: workflowVersion.id,
        });
      }

      await client.query(`DELETE FROM node WHERE workflow_version_id = $1`, [workflowVersion.id]);
      await client.query(`DELETE FROM workflow_version WHERE id = $1`, [workflowVersion.id]);
      await client.query("COMMIT");

      return true;
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

  async getWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    const { workflowId, version } = workflowVersionRefSchema.parse(input);

    try {
      const result = await this.pool.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = $2`,
        [workflowId, version],
      );

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
