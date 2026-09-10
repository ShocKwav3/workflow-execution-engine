export interface WorkflowRow {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export const WORKFLOW_VERSION_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export type WorkflowVersionStatus = (typeof WORKFLOW_VERSION_STATUSES)[number];

export const WORKFLOW_VERSION_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const satisfies Record<string, WorkflowVersionStatus>;

// PENDING is the column default; RUNNING and COMPLETED are written once execution exists. FAILED
// is deliberately absent — nothing fails an execution yet.
export const EXECUTION_STATUSES = ["PENDING", "RUNNING", "COMPLETED"] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const EXECUTION_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
} as const satisfies Record<string, ExecutionStatus>;

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
  status: ExecutionStatus;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface NodeExecutionRow {
  id: string;
  workflow_execution_id: string;
  node_id: string;
  status: ExecutionStatus;
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
