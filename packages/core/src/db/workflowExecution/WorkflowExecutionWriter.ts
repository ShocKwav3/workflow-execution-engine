import type { CreateWorkflowExecutionInput } from "./workflowExecution.schemas.js";
import type { WorkflowExecutionRow } from "../types.js";

export interface CreateWorkflowExecutionResult {
  execution: WorkflowExecutionRow;
  created: boolean;
}

export interface WorkflowExecutionWriter {
  createWorkflowExecution(
    input: CreateWorkflowExecutionInput,
  ): Promise<CreateWorkflowExecutionResult>;
  markWorkflowExecutionRunning(id: string): Promise<WorkflowExecutionRow | undefined>;
  markWorkflowExecutionCompleted(id: string): Promise<boolean>;
}
