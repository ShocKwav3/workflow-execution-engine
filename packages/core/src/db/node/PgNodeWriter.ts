import type { PoolClient } from "pg";
import { NodeOrderingMismatchError, VersionNotDraftError } from "@/errors/domain/index.js";
import { parseInternal } from "@/errors/index.js";
import { ClassifiedError } from "@/errors/index.js";
import { WORKFLOW_VERSION_STATUS } from "../types.js";
import { classifyPgError } from "../errors/index.js";
import {
  type CreateNodeInput,
  type ReorderNodesInput,
  type UpdateNodeInput,
  createNodeInputSchema,
  nodeIdSchema,
  reorderNodesInputSchema,
  updateNodeInputSchema,
} from "./node.schemas.js";
import type { NodeWriter } from "./NodeWriter.js";
import type { NodeRow, WorkflowVersionRow } from "../types.js";

function assertDraft(workflowVersion: WorkflowVersionRow): void {
  if (workflowVersion.status !== WORKFLOW_VERSION_STATUS.DRAFT) {
    throw new VersionNotDraftError(workflowVersion.version, {
      workflowId: workflowVersion.workflow_id,
      workflowVersionId: workflowVersion.id,
    });
  }
}

export class PgNodeWriter implements NodeWriter {
  constructor(private readonly client: PoolClient) {}

  async createNode(input: CreateNodeInput): Promise<NodeRow | undefined> {
    const { workflowId, version, name, type } = parseInternal(
      createNodeInputSchema,
      input,
      "PgNodeWriter.createNode",
    );

    return this.onDraftVersion(
      () => this.lockVersionByRef(workflowId, version),
      async (workflowVersion) => {
        const next = await this.client.query<{ next_sequence: number }>(
          `SELECT COALESCE(MAX(sequence) + 1, 0) AS next_sequence
           FROM node WHERE workflow_version_id = $1`,
          [workflowVersion.id],
        );

        const inserted = await this.client.query<NodeRow>(
          `INSERT INTO node (workflow_version_id, name, type, sequence)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [workflowVersion.id, name, type, next.rows[0]!.next_sequence],
        );

        return inserted.rows[0]!;
      },
    );
  }

  async updateNode(id: string, input: UpdateNodeInput): Promise<NodeRow | undefined> {
    const validId = parseInternal(nodeIdSchema, id, "PgNodeWriter.updateNode id");
    const { name, type } = parseInternal(
      updateNodeInputSchema,
      input,
      "PgNodeWriter.updateNode input",
    );

    return this.onDraftVersion(
      () => this.lockVersionByNodeId(validId),
      async () => {
        const updated = await this.client.query<NodeRow>(
          `UPDATE node
           SET name = COALESCE($2, name), type = COALESCE($3, type)
           WHERE id = $1
           RETURNING *`,
          [validId, name ?? null, type ?? null],
        );

        return updated.rows[0]!;
      },
    );
  }

  async deleteNode(id: string): Promise<boolean> {
    const validId = parseInternal(nodeIdSchema, id, "PgNodeWriter.deleteNode");

    const deleted = await this.onDraftVersion(
      () => this.lockVersionByNodeId(validId),
      async () => {
        await this.client.query(`DELETE FROM node WHERE id = $1`, [validId]);

        return true as const;
      },
    );

    return deleted ?? false;
  }

  async reorderNodes(input: ReorderNodesInput): Promise<NodeRow[] | undefined> {
    const { workflowId, version, nodeIds } = parseInternal(
      reorderNodesInputSchema,
      input,
      "PgNodeWriter.reorderNodes",
    );

    return this.onDraftVersion(
      () => this.lockVersionByRef(workflowId, version),
      async (workflowVersion) => {
        const existing = await this.client.query<{ id: string }>(
          `SELECT id FROM node WHERE workflow_version_id = $1`,
          [workflowVersion.id],
        );
        const existingIds = new Set(existing.rows.map((row) => row.id));
        const submittedIds = new Set(nodeIds);

        if (
          submittedIds.size !== nodeIds.length ||
          submittedIds.size !== existingIds.size ||
          nodeIds.some((nodeId) => !existingIds.has(nodeId))
        ) {
          throw new NodeOrderingMismatchError({
            workflowId,
            version: workflowVersion.version,
            workflowVersionId: workflowVersion.id,
            submitted: nodeIds.length,
            expected: existingIds.size,
          });
        }

        // Parked in a range the final positions can never occupy, so no row collides mid-rewrite.
        await this.client.query(
          `UPDATE node SET sequence = -(sequence + 1) WHERE workflow_version_id = $1`,
          [workflowVersion.id],
        );

        const reordered = await this.client.query<NodeRow>(
          `UPDATE node
           SET sequence = (position.ordinality - 1)::int
           FROM unnest($2::uuid[]) WITH ORDINALITY AS position(id, ordinality)
           WHERE node.id = position.id AND node.workflow_version_id = $1
           RETURNING node.*`,
          [workflowVersion.id, nodeIds],
        );

        return reordered.rows.sort((a, b) => a.sequence - b.sequence);
      },
    );
  }

  private async lockVersionByRef(
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowVersionRow | undefined> {
    const result = await this.client.query<WorkflowVersionRow>(
      `SELECT * FROM workflow_version WHERE workflow_id = $1 AND id = $2 FOR UPDATE`,
      [workflowId, versionId],
    );

    return result.rows[0];
  }

  private async lockVersionByNodeId(nodeId: string): Promise<WorkflowVersionRow | undefined> {
    const result = await this.client.query<WorkflowVersionRow>(
      `SELECT workflow_version.*
       FROM workflow_version
       JOIN node ON node.workflow_version_id = workflow_version.id
       WHERE node.id = $1
       FOR UPDATE OF workflow_version`,
      [nodeId],
    );

    return result.rows[0];
  }

  private async onDraftVersion<T>(
    lock: () => Promise<WorkflowVersionRow | undefined>,
    write: (workflowVersion: WorkflowVersionRow) => Promise<T>,
  ): Promise<T | undefined> {
    try {
      const workflowVersion = await lock();

      if (!workflowVersion) {
        return undefined;
      }

      assertDraft(workflowVersion);

      return await write(workflowVersion);
    } catch (error) {
      if (error instanceof ClassifiedError) {
        throw error;
      }

      throw classifyPgError(error);
    }
  }
}
