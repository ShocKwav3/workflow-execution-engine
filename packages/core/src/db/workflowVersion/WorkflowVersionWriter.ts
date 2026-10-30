import type { CreateWorkflowVersionInput, WorkflowVersionRef } from "./workflowVersion.schemas.js";
import type { WorkflowVersionRow } from "../types.js";

export interface WorkflowVersionWriter {
  createWorkflowVersion(input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow | undefined>;
  publishWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined>;
  deleteWorkflowVersion(input: WorkflowVersionRef): Promise<boolean>;
}
