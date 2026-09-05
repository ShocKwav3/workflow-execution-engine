import type { NodeExecutionReader } from "@/db/nodeExecution/NodeExecutionReader.js";
import type {
  GetNodeExecutionInput,
  WorkflowExecutionRef,
} from "@/db/nodeExecution/nodeExecution.schemas.js";
import type { NodeExecutionHistoryEntry } from "@/db/nodeExecution/executionHistoryGrouping.js";
import type { NodeExecutionRow } from "@/db/types.js";

export class NodeExecutionService {
  constructor(private readonly nodeExecutions: NodeExecutionReader) {}

  async getNodeExecutionsForWorkflowExecution(
    input: WorkflowExecutionRef,
  ): Promise<NodeExecutionRow[]> {
    return this.nodeExecutions.getNodeExecutionsForWorkflowExecution(input);
  }

  async getWorkflowExecutionHistory(
    input: WorkflowExecutionRef,
  ): Promise<NodeExecutionHistoryEntry[]> {
    return this.nodeExecutions.getWorkflowExecutionHistory(input);
  }

  async getNodeExecutionByNodeAndExecution(
    input: GetNodeExecutionInput,
  ): Promise<NodeExecutionHistoryEntry | undefined> {
    return this.nodeExecutions.getNodeExecutionByNodeAndExecution(input);
  }
}
