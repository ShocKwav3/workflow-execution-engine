import type { Pool, PoolClient } from "pg";

// Accepted by every repository function so they work identically whether called
// with the pool directly or with a client borrowed from a transaction (see createExecution).
export type Queryable = Pool | PoolClient;

export interface WorkflowRow {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface StepDefinition {
  name: string;
  type: string;
}

export interface WorkflowVersionRow {
  id: string;
  workflow_id: string;
  version: number;
  definition: StepDefinition[];
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

export interface StepExecutionRow {
  id: string;
  workflow_execution_id: string;
  step_name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface StepAttemptRow {
  id: string;
  step_execution_id: string;
  attempt_number: number;
  status: string;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
}
