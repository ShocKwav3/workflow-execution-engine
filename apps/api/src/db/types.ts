import type { Pool, PoolClient } from "pg";

// Works with either the pool directly or a client borrowed from a transaction.
export type Queryable = Pool | PoolClient;

export interface WorkflowRow {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export type WorkflowVersionStatus = "DRAFT" | "PUBLISHED";

export interface WorkflowVersionRow {
  id: string;
  workflow_id: string;
  version: number;
  status: WorkflowVersionStatus;
  created_at: Date;
  published_at: Date | null;
}

export interface NodeRow {
  id: string;
  workflow_version_id: string;
  name: string;
  type: string;
  sequence: number;
  created_at: Date;
}

export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  workflow_version_id: string;
  status: string;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface NodeExecutionRow {
  id: string;
  workflow_execution_id: string;
  node_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface NodeExecutionAttemptRow {
  id: string;
  node_execution_id: string;
  attempt_number: number;
  status: string;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
}
