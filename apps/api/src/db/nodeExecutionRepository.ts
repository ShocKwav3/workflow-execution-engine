import { classifyPgError } from "./errors/index.js";
import {
  type NodeExecutionHistoryEntry,
  type NodeHistoryQueryRow,
  groupNodeHistoryRows,
} from "./helpers/executionHistoryGrouping.js";
import {
  type GetNodeExecutionInput,
  getNodeExecutionInputSchema,
  workflowExecutionIdSchema,
} from "./nodeExecutionRepository.schemas.js";
import type { Queryable, NodeExecutionRow } from "./types.js";

const NODE_EXECUTION_HISTORY_QUERY = `
  SELECT
    ne.id AS node_execution_id,
    ne.workflow_execution_id,
    ne.node_id,
    n.name AS node_name,
    n.type AS node_type,
    n.sequence AS node_sequence,
    ne.status AS node_execution_status,
    ne.created_at AS node_execution_created_at,
    ne.updated_at AS node_execution_updated_at,
    nea.id AS attempt_id,
    nea.attempt_number,
    nea.status AS attempt_status,
    nea.started_at,
    nea.finished_at,
    nea.error
  FROM node_execution ne
  JOIN node n ON n.id = ne.node_id
  LEFT JOIN node_execution_attempt nea ON nea.node_execution_id = ne.id
`;

export class NodeExecutionRepository {
  constructor(private readonly db: Queryable) {}

  async getNodeExecutionsForWorkflowExecution(
    workflowExecutionId: string,
  ): Promise<NodeExecutionRow[]> {
    const validId = workflowExecutionIdSchema.parse(workflowExecutionId);

    try {
      const result = await this.db.query<NodeExecutionRow>(
        `SELECT * FROM node_execution WHERE workflow_execution_id = $1 ORDER BY created_at`,
        [validId],
      );

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async getWorkflowExecutionHistory(
    workflowExecutionId: string,
  ): Promise<NodeExecutionHistoryEntry[]> {
    const validId = workflowExecutionIdSchema.parse(workflowExecutionId);

    try {
      const result = await this.db.query<NodeHistoryQueryRow>(
        `${NODE_EXECUTION_HISTORY_QUERY}
         WHERE ne.workflow_execution_id = $1
         ORDER BY n.sequence, nea.attempt_number`,
        [validId],
      );

      return groupNodeHistoryRows(result.rows);
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  // Backs GET /nodes/{nodeId}/executions/{executionId} — a node's run within one specific execution.
  async getNodeExecutionByNodeAndExecution(
    input: GetNodeExecutionInput,
  ): Promise<NodeExecutionHistoryEntry | undefined> {
    const { nodeId, workflowExecutionId } = getNodeExecutionInputSchema.parse(input);

    try {
      const result = await this.db.query<NodeHistoryQueryRow>(
        `${NODE_EXECUTION_HISTORY_QUERY}
         WHERE ne.node_id = $1 AND ne.workflow_execution_id = $2
         ORDER BY nea.attempt_number`,
        [nodeId, workflowExecutionId],
      );

      return groupNodeHistoryRows(result.rows)[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
