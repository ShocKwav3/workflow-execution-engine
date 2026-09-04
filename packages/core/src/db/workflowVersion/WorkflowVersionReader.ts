import type { WorkflowVersionRef } from "./workflowVersion.schemas.js";
import type { WorkflowVersionRow } from "../types.js";

export interface WorkflowVersionReader {
  getWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined>;
}
