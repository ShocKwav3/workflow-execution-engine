import type { WorkflowReader } from "@/db/workflow/WorkflowReader.js";
import type { WorkflowUnitOfWork } from "@/db/workflow/WorkflowUnitOfWork.js";
import type { WorkflowVersionReader } from "@/db/workflowVersion/WorkflowVersionReader.js";
import type { WorkflowVersionUnitOfWork } from "@/db/workflowVersion/WorkflowVersionUnitOfWork.js";
import type { CreateWorkflowInput } from "@/db/workflow/workflow.schemas.js";
import type {
  CreateWorkflowVersionInput,
  WorkflowVersionRef,
} from "@/db/workflowVersion/workflowVersion.schemas.js";
import type { WorkflowRow, WorkflowVersionRow } from "@/db/types.js";

export class WorkflowService {
  constructor(
    private readonly workflows: WorkflowReader,
    private readonly workflowUnitOfWork: WorkflowUnitOfWork,
    private readonly workflowVersions: WorkflowVersionReader,
    private readonly workflowVersionUnitOfWork: WorkflowVersionUnitOfWork,
  ) {}

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow> {
    return this.workflowUnitOfWork.run((scope) => scope.workflows.createWorkflow(input));
  }

  async getWorkflowById(id: string): Promise<WorkflowRow | undefined> {
    return this.workflows.getWorkflowById(id);
  }

  async listWorkflows(): Promise<WorkflowRow[]> {
    return this.workflows.listWorkflows();
  }

  async createWorkflowVersion(input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow> {
    return this.workflowVersionUnitOfWork.run((scope) =>
      scope.workflowVersions.createWorkflowVersion(input),
    );
  }

  async publishWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    return this.workflowVersionUnitOfWork.run((scope) =>
      scope.workflowVersions.publishWorkflowVersion(input),
    );
  }

  async deleteWorkflowVersion(input: WorkflowVersionRef): Promise<boolean> {
    return this.workflowVersionUnitOfWork.run((scope) =>
      scope.workflowVersions.deleteWorkflowVersion(input),
    );
  }

  async getWorkflowVersion(input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> {
    return this.workflowVersions.getWorkflowVersion(input);
  }
}
