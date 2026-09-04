import type { CreateExecutionInput } from "@/db/workflowExecution/workflowExecution.schemas.js";
import type { WorkflowExecutionReader } from "@/db/workflowExecution/WorkflowExecutionReader.js";
import type { WorkflowExecutionUnitOfWork } from "@/db/workflowExecution/WorkflowExecutionUnitOfWork.js";
import type { WorkflowExecutionRow } from "@/db/types.js";

export class WorkflowExecutionService {
  constructor(
    private readonly reader: WorkflowExecutionReader,
    private readonly unitOfWork: WorkflowExecutionUnitOfWork,
  ) {}

  async createWorkflowExecution(input: CreateExecutionInput): Promise<WorkflowExecutionRow> {
    const { execution } = await this.unitOfWork.run(({ workflowExecutions }) =>
      workflowExecutions.createWorkflowExecution(input),
    );

    return execution;
  }

  async getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined> {
    return this.reader.getWorkflowExecutionById(id);
  }
}
