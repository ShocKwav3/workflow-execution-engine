import type { NodeExecutionHistoryEntry } from "./executionHistoryGrouping.js";
import type { GetNodeExecutionInput, WorkflowExecutionRef } from "./nodeExecution.schemas.js";
import type { NodeExecutionRow } from "../types.js";

export interface NodeExecutionReader {
  getNodeExecutionsForWorkflowExecution(input: WorkflowExecutionRef): Promise<NodeExecutionRow[]>;
  getWorkflowExecutionHistory(input: WorkflowExecutionRef): Promise<NodeExecutionHistoryEntry[]>;
  getNodeExecutionByNodeAndExecution(
    input: GetNodeExecutionInput,
  ): Promise<NodeExecutionHistoryEntry | undefined>;
}
