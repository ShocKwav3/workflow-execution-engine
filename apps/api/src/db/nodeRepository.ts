import type { Pool, PoolClient } from "pg";
import { NodeOrderingMismatchError, VersionNotDraftError } from "../errors/domain/index.js";
import { ClassifiedError } from "../errors/index.js";
import { classifyPgError } from "./errors/index.js";
import type { NodeRow, WorkflowVersionRow } from "./types.js";
import {
  type CreateNodeInput,
  type ReorderNodesInput,
  type UpdateNodeInput,
  createNodeInputSchema,
  nodeIdSchema,
  reorderNodesInputSchema,
  updateNodeInputSchema,
} from "./nodeRepository.schemas.js";
import { type WorkflowVersionRef, workflowVersionRefSchema } from "./workflowRepository.schemas.js";

async function lockVersionByRef(
  client: PoolClient,
  workflowId: string,
  version: number,
): Promise<WorkflowVersionRow | undefined> {
  const result = await client.query<WorkflowVersionRow>(
    `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = $2 FOR UPDATE`,
    [workflowId, version],
  );

  return result.rows[0];
}

async function lockVersionByNodeId(
  client: PoolClient,
  nodeId: string,
): Promise<WorkflowVersionRow | undefined> {
  const result = await client.query<WorkflowVersionRow>(
    `SELECT workflow_version.*
     FROM workflow_version
     JOIN node ON node.workflow_version_id = workflow_version.id
     WHERE node.id = $1
     FOR UPDATE OF workflow_version`,
    [nodeId],
  );

  return result.rows[0];
}

function assertDraft(workflowVersion: WorkflowVersionRow): void {
  if (workflowVersion.status !== "DRAFT") {
    throw new VersionNotDraftError(workflowVersion.version, {
      workflowId: workflowVersion.workflow_id,
      workflowVersionId: workflowVersion.id,
    });
  }
}

export class NodeRepository {
  constructor(private readonly pool: Pool) {}

  async getNodeById(id: string): Promise<NodeRow | undefined> {
    const validId = nodeIdSchema.parse(id);

    try {
      const result = await this.pool.query<NodeRow>(`SELECT * FROM node WHERE id = $1`, [validId]);

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async listNodesForVersion(input: WorkflowVersionRef): Promise<NodeRow[] | undefined> {
    const { workflowId, version } = workflowVersionRefSchema.parse(input);

    try {
      const result = await this.pool.query<NodeRow>(
        `SELECT node.*
         FROM node
         JOIN workflow_version ON workflow_version.id = node.workflow_version_id
         WHERE workflow_version.workflow_id = $1 AND workflow_version.version = $2
         ORDER BY node.sequence`,
        [workflowId, version],
      );

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async createNode(input: CreateNodeInput): Promise<NodeRow | undefined> {
    const { workflowId, version, name, type } = createNodeInputSchema.parse(input);

    return this.inVersionTransaction(
      (client) => lockVersionByRef(client, workflowId, version),
      async (client, workflowVersion) => {
        const next = await client.query<{ next_sequence: number }>(
          `SELECT COALESCE(MAX(sequence) + 1, 0) AS next_sequence
           FROM node WHERE workflow_version_id = $1`,
          [workflowVersion.id],
        );

        const inserted = await client.query<NodeRow>(
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
    const validId = nodeIdSchema.parse(id);
    const { name, type } = updateNodeInputSchema.parse(input);

    return this.inVersionTransaction(
      (client) => lockVersionByNodeId(client, validId),
      async (client) => {
        const updated = await client.query<NodeRow>(
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
    const validId = nodeIdSchema.parse(id);

    const deleted = await this.inVersionTransaction(
      (client) => lockVersionByNodeId(client, validId),
      async (client) => {
        await client.query(`DELETE FROM node WHERE id = $1`, [validId]);

        return true as const;
      },
    );

    return deleted ?? false;
  }

  async reorderNodes(input: ReorderNodesInput): Promise<NodeRow[] | undefined> {
    const { workflowId, version, nodeIds } = reorderNodesInputSchema.parse(input);

    return this.inVersionTransaction(
      (client) => lockVersionByRef(client, workflowId, version),
      async (client, workflowVersion) => {
        const existing = await client.query<{ id: string }>(
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
            version,
            workflowVersionId: workflowVersion.id,
            submitted: nodeIds.length,
            expected: existingIds.size,
          });
        }

        // Parked in a range the final positions can never occupy, so no row collides mid-rewrite.
        await client.query(
          `UPDATE node SET sequence = -(sequence + 1) WHERE workflow_version_id = $1`,
          [workflowVersion.id],
        );

        const reordered = await client.query<NodeRow>(
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

  private async inVersionTransaction<T>(
    lock: (client: PoolClient) => Promise<WorkflowVersionRow | undefined>,
    write: (client: PoolClient, workflowVersion: WorkflowVersionRow) => Promise<T>,
  ): Promise<T | undefined> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const workflowVersion = await lock(client);

      if (!workflowVersion) {
        await client.query("ROLLBACK");

        return undefined;
      }

      assertDraft(workflowVersion);

      const result = await write(client, workflowVersion);

      await client.query("COMMIT");

      return result;
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
}
