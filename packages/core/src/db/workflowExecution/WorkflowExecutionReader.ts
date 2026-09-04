import type { WorkflowExecutionRow } from "../types.js";

export interface WorkflowExecutionReader {
  getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined>;
}
