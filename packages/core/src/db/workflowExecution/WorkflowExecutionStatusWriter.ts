import type { WorkflowExecutionRow } from "../types.js";

export interface WorkflowExecutionStatusWriter {
  markWorkflowExecutionRunning(id: string): Promise<WorkflowExecutionRow | undefined>;
  markWorkflowExecutionCompleted(id: string): Promise<boolean>;
}
