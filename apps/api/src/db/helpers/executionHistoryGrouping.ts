import type { NodeExecutionAttemptRow } from "../types.js";

export interface NodeExecutionWithNode {
  id: string;
  workflow_execution_id: string;
  node_id: string;
  name: string;
  type: string;
  sequence: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface NodeExecutionHistoryEntry {
  node: NodeExecutionWithNode;
  attempts: NodeExecutionAttemptRow[];
}

export interface NodeHistoryQueryRow {
  node_execution_id: string;
  workflow_execution_id: string;
  node_id: string;
  node_name: string;
  node_type: string;
  node_sequence: number;
  node_execution_status: string;
  node_execution_created_at: Date;
  node_execution_updated_at: Date;
  attempt_id: string | null;
  attempt_number: number | null;
  attempt_status: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
}

// Pure, no I/O — kept separate so it's unit-testable without a real database.
export function groupNodeHistoryRows(rows: NodeHistoryQueryRow[]): NodeExecutionHistoryEntry[] {
  const nodesById = new Map<string, NodeExecutionHistoryEntry>();

  for (const row of rows) {
    let entry = nodesById.get(row.node_execution_id);

    if (!entry) {
      entry = {
        node: {
          id: row.node_execution_id,
          workflow_execution_id: row.workflow_execution_id,
          node_id: row.node_id,
          name: row.node_name,
          type: row.node_type,
          sequence: row.node_sequence,
          status: row.node_execution_status,
          created_at: row.node_execution_created_at,
          updated_at: row.node_execution_updated_at,
        },
        attempts: [],
      };
      nodesById.set(row.node_execution_id, entry);
    }

    if (row.attempt_id) {
      entry.attempts.push({
        id: row.attempt_id,
        node_execution_id: row.node_execution_id,
        attempt_number: row.attempt_number!,
        status: row.attempt_status!,
        started_at: row.started_at,
        finished_at: row.finished_at,
        error: row.error,
      });
    }
  }

  return [...nodesById.values()];
}
