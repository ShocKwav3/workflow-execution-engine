import type { WorkflowExecutionRepository } from "@/db/workflowExecutionRepository.js";
import type { CreateExecutionInput } from "@/db/workflowExecutionRepository.schemas.js";
import type { WorkflowExecutionRow } from "@/db/types.js";

export class WorkflowExecutionService {
  constructor(private readonly repository: WorkflowExecutionRepository) {}

  async createWorkflowExecution(input: CreateExecutionInput): Promise<WorkflowExecutionRow> {
    return this.repository.createWorkflowExecution(input);
  }

  async getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined> {
    return this.repository.getWorkflowExecutionById(id);
  }
}
