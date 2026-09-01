import type { WorkflowRepository } from "@/db/workflowRepository.js";
import type {
  CreateWorkflowInput,
  CreateWorkflowVersionInput,
  WorkflowVersionRef,
} from "@/db/workflowRepository.schemas.js";
import type { WorkflowRow, WorkflowVersionRow } from "@/db/types.js";

export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow> {
    return this.repository.createWorkflow(input);
  }

  async getWorkflowById(id: string): Promise<WorkflowRow | undefined> {
    return this.repository.getWorkflowById(id);
  }

  async listWorkflows(): Promise<WorkflowRow[]> {
    return this.repository.listWorkflows();
  }

  async createWorkflowVersion(input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow> {
    return this.repository.createWorkflowVersion(input);
  }

  async publishWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    return this.repository.publishWorkflowVersion(input);
  }

  async deleteWorkflowVersion(input: WorkflowVersionRef): Promise<boolean> {
    return this.repository.deleteWorkflowVersion(input);
  }

  async getWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    return this.repository.getWorkflowVersion(input);
  }
}
