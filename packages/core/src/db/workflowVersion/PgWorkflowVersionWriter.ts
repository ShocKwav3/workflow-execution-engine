import type { PoolClient } from "pg";
import {
  VersionAlreadyPublishedError,
  VersionHasNoNodesError,
  VersionNotDraftError,
} from "@/errors/domain/index.js";
import { ClassifiedError, parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import {
  type CreateWorkflowVersionInput,
  type WorkflowVersionRef,
  createWorkflowVersionInputSchema,
  workflowVersionRefSchema,
} from "./workflowVersion.schemas.js";
import type { WorkflowVersionWriter } from "./WorkflowVersionWriter.js";
import type { WorkflowVersionRow } from "../types.js";

export class PgWorkflowVersionWriter implements WorkflowVersionWriter {
  constructor(private readonly client: PoolClient) {}

  async createWorkflowVersion(input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow> {
    const { workflowId, version } = parseInternal(
      createWorkflowVersionInputSchema,
      input,
      "PgWorkflowVersionWriter.createWorkflowVersion",
    );

    try {
      const result = await this.client.query<WorkflowVersionRow>(
        `INSERT INTO workflow_version (workflow_id, version) VALUES ($1, $2) RETURNING *`,
        [workflowId, version],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async publishWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    const { workflowId, version: versionId } = parseInternal(
      workflowVersionRefSchema,
      input,
      "PgWorkflowVersionWriter.publishWorkflowVersion",
    );

    try {
      const workflowVersion = await this.lockVersion(workflowId, versionId);

      if (!workflowVersion) {
        return undefined;
      }

      if (workflowVersion.status !== "DRAFT") {
        throw new VersionAlreadyPublishedError(workflowVersion.version, {
          workflowId,
          workflowVersionId: workflowVersion.id,
        });
      }

      const nodeCount = await this.client.query<{ count: string }>(
        `SELECT count(*) AS count FROM node WHERE workflow_version_id = $1`,
        [workflowVersion.id],
      );

      if (Number(nodeCount.rows[0]!.count) === 0) {
        throw new VersionHasNoNodesError(workflowVersion.version, {
          workflowId,
          workflowVersionId: workflowVersion.id,
        });
      }

      const published = await this.client.query<WorkflowVersionRow>(
        `UPDATE workflow_version SET status = 'PUBLISHED', published_at = now()
         WHERE id = $1
         RETURNING *`,
        [workflowVersion.id],
      );

      return published.rows[0]!;
    } catch (error) {
      if (error instanceof ClassifiedError) {
        throw error;
      }

      throw classifyPgError(error);
    }
  }

  async deleteWorkflowVersion(input: WorkflowVersionRef): Promise<boolean> {
    const { workflowId, version: versionId } = parseInternal(
      workflowVersionRefSchema,
      input,
      "PgWorkflowVersionWriter.deleteWorkflowVersion",
    );

    try {
      const workflowVersion = await this.lockVersion(workflowId, versionId);

      if (!workflowVersion) {
        return false;
      }

      if (workflowVersion.status !== "DRAFT") {
        throw new VersionNotDraftError(workflowVersion.version, {
          workflowId,
          workflowVersionId: workflowVersion.id,
        });
      }

      await this.client.query(`DELETE FROM node WHERE workflow_version_id = $1`, [
        workflowVersion.id,
      ]);
      await this.client.query(`DELETE FROM workflow_version WHERE id = $1`, [workflowVersion.id]);

      return true;
    } catch (error) {
      if (error instanceof ClassifiedError) {
        throw error;
      }

      throw classifyPgError(error);
    }
  }

  private async lockVersion(
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowVersionRow | undefined> {
    const result = await this.client.query<WorkflowVersionRow>(
      `SELECT * FROM workflow_version WHERE workflow_id = $1 AND id = $2 FOR UPDATE`,
      [workflowId, versionId],
    );

    return result.rows[0];
  }
}
