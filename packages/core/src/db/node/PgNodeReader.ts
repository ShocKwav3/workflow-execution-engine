import type { Pool } from "pg";
import { classifyPgError } from "../errors/index.js";
import { nodeIdSchema } from "./node.schemas.js";
import {
  type WorkflowVersionRef,
  workflowVersionRefSchema,
} from "../workflowVersion/workflowVersion.schemas.js";
import type { NodeReader } from "./NodeReader.js";
import type { NodeRow } from "../types.js";

export class PgNodeReader implements NodeReader {
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
         WHERE workflow_version.workflow_id = $1 AND workflow_version.id = $2
         ORDER BY node.sequence`,
        [workflowId, version],
      );

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
