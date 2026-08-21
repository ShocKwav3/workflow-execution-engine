import type { Pool } from "pg";
import { classifyPgError } from "./errors/index.js";
import type { NodeRow, WorkflowRow, WorkflowVersionRow } from "./types.js";
import {
  type CreateWorkflowInput,
  type CreateWorkflowVersionInput,
  type GetWorkflowVersionInput,
  createWorkflowInputSchema,
  createWorkflowVersionInputSchema,
  getWorkflowVersionInputSchema,
  workflowIdSchema,
} from "./workflowRepository.schemas.js";

export interface WorkflowVersionWithNodes {
  version: WorkflowVersionRow;
  nodes: NodeRow[];
}

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

  // Version + its nodes commit atomically — a version is never left with a partial node set.
  async createWorkflowVersion(
    input: CreateWorkflowVersionInput,
  ): Promise<WorkflowVersionWithNodes> {
    const { workflowId, version, definition } = createWorkflowVersionInputSchema.parse(input);

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const versionResult = await client.query<WorkflowVersionRow>(
        `INSERT INTO workflow_version (workflow_id, version) VALUES ($1, $2) RETURNING *`,
        [workflowId, version],
      );
      const workflowVersion = versionResult.rows[0]!;

      const nodes: NodeRow[] = [];

      for (const [sequence, node] of definition.entries()) {
        const nodeResult = await client.query<NodeRow>(
          `INSERT INTO node (workflow_version_id, name, type, sequence)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [workflowVersion.id, node.name, node.type, sequence],
        );

        nodes.push(nodeResult.rows[0]!);
      }

      await client.query("COMMIT");

      return { version: workflowVersion, nodes };
    } catch (error) {
      await client.query("ROLLBACK");
      throw classifyPgError(error);
    } finally {
      client.release();
    }
  }

  async getWorkflowVersion(
    input: GetWorkflowVersionInput,
  ): Promise<WorkflowVersionWithNodes | undefined> {
    const { workflowId, version } = getWorkflowVersionInputSchema.parse(input);

    try {
      const versionResult = await this.pool.query<WorkflowVersionRow>(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = $2`,
        [workflowId, version],
      );
      const workflowVersion = versionResult.rows[0];

      if (!workflowVersion) {
        return undefined;
      }

      const nodesResult = await this.pool.query<NodeRow>(
        `SELECT * FROM node WHERE workflow_version_id = $1 ORDER BY sequence`,
        [workflowVersion.id],
      );

      return { version: workflowVersion, nodes: nodesResult.rows };
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
