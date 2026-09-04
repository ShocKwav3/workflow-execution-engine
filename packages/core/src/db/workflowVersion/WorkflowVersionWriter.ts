import type { CreateWorkflowVersionInput, WorkflowVersionRef } from "./workflowVersion.schemas.js";
import type { WorkflowVersionRow } from "../types.js";

export interface WorkflowVersionWriter {
  createWorkflowVersion(input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow>;
  publishWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined>;
  deleteWorkflowVersion(input: WorkflowVersionRef): Promise<boolean>;
}
