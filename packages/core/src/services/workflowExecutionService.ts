import { createStartWorkflowExecutionMessage } from "@/amqp/messages/startWorkflowExecution.js";
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
    return this.unitOfWork.run(async ({ workflowExecutions, workflowExecutionOutbox }) => {
      const { execution, created } = await workflowExecutions.createWorkflowExecution(input);

      // An idempotent replay returns the original execution, which was already queued once.
      if (created) {
        await workflowExecutionOutbox.addStartCommand(
          createStartWorkflowExecutionMessage(execution.id),
        );
      }

      return execution;
    });
  }

  async getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined> {
    return this.reader.getWorkflowExecutionById(id);
  }
}
