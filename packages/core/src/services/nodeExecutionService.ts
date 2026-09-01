import type { NodeExecutionRepository } from "@/db/nodeExecutionRepository.js";
import type {
  GetNodeExecutionInput,
  WorkflowExecutionRef,
} from "@/db/nodeExecutionRepository.schemas.js";
import type { NodeExecutionHistoryEntry } from "@/db/helpers/executionHistoryGrouping.js";
import type { NodeExecutionRow } from "@/db/types.js";

export class NodeExecutionService {
  constructor(private readonly repository: NodeExecutionRepository) {}

  async getNodeExecutionsForWorkflowExecution(
    input: WorkflowExecutionRef,
  ): Promise<NodeExecutionRow[]> {
    return this.repository.getNodeExecutionsForWorkflowExecution(input);
  }

  async getWorkflowExecutionHistory(
    input: WorkflowExecutionRef,
  ): Promise<NodeExecutionHistoryEntry[]> {
    return this.repository.getWorkflowExecutionHistory(input);
  }

  async getNodeExecutionByNodeAndExecution(
    input: GetNodeExecutionInput,
  ): Promise<NodeExecutionHistoryEntry | undefined> {
    return this.repository.getNodeExecutionByNodeAndExecution(input);
  }
}
