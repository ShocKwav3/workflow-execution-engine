import type { CreateExecutionInput } from "./workflowExecution.schemas.js";
import type { WorkflowExecutionRow } from "../types.js";

export interface CreateWorkflowExecutionResult {
  execution: WorkflowExecutionRow;
  created: boolean;
}

export interface WorkflowExecutionWriter {
  createWorkflowExecution(input: CreateExecutionInput): Promise<CreateWorkflowExecutionResult>;
}
