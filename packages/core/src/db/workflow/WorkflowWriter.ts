import type { CreateWorkflowInput } from "./workflow.schemas.js";
import type { WorkflowRow } from "../types.js";

export interface WorkflowWriter {
  createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow>;
}
