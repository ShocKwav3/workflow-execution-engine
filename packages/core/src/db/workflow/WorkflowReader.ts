import type { WorkflowRow } from "../types.js";

export interface WorkflowReader {
  getWorkflowById(id: string): Promise<WorkflowRow | undefined>;
  listWorkflows(): Promise<WorkflowRow[]>;
}
