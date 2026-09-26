import type { CreateWorkflowExecutionInput } from "@/db/workflowExecution/workflowExecution.schemas.js";
import type { WorkflowExecutionReader } from "@/db/workflowExecution/WorkflowExecutionReader.js";
import type { WorkflowExecutionUnitOfWork } from "@/db/workflowExecution/WorkflowExecutionUnitOfWork.js";
import type { WorkflowExecutionRow } from "@/db/types.js";
import { parseInternal } from "@/errors/index.js";
import { OUTBOX_DESTINATION } from "@/schemas/outboxMessage.schemas.js";
import {
  START_WORKFLOW_EXECUTION,
  startWorkflowExecutionJobSchema,
} from "@/schemas/startWorkflowExecutionJob.schemas.js";

export class WorkflowExecutionService {
  constructor(
    private readonly reader: WorkflowExecutionReader,
    private readonly unitOfWork: WorkflowExecutionUnitOfWork,
  ) {}

  async createWorkflowExecution({
    correlationId,
    ...input
  }: CreateWorkflowExecutionInput & { correlationId: string }): Promise<WorkflowExecutionRow> {
    return this.unitOfWork.run(async ({ workflowExecutions, outboxMessages }) => {
      const { execution, created } = await workflowExecutions.createWorkflowExecution(input);

      // An idempotent replay must not dispatch the work a second time.
      if (!created) {
        return execution;
      }

      const payload = parseInternal(
        startWorkflowExecutionJobSchema,
        { schemaVersion: 1, executionId: execution.id, correlationId },
        "WorkflowExecutionService.createWorkflowExecution payload",
      );

      await outboxMessages.createOutboxMessage({
        destination: OUTBOX_DESTINATION.bullmq,
        messageType: START_WORKFLOW_EXECUTION,
        payload,
        correlationId,
      });

      return execution;
    });
  }

  async getWorkflowExecutionById(id: string): Promise<WorkflowExecutionRow | undefined> {
    return this.reader.getWorkflowExecutionById(id);
  }
}
