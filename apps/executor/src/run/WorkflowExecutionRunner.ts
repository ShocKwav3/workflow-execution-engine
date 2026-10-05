import type { NodeExecutionReader } from "@workflow-engine/core/db/nodeExecution/NodeExecutionReader.js";
import type { NodeExecutionUnitOfWork } from "@workflow-engine/core/db/nodeExecution/NodeExecutionUnitOfWork.js";
import type { NodeExecutionStepRow } from "@workflow-engine/core/db/types.js";
import type { WorkflowExecutionStatusWriter } from "@workflow-engine/core/db/workflowExecution/WorkflowExecutionStatusWriter.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { NODE_EXECUTION_STATUS } from "@workflow-engine/core/schemas/nodeExecution.schemas.js";
import { ExecutionStateConflictError } from "./ExecutionStateConflictError.js";
import type { NodeWork } from "./NodeWork.js";

export interface RunWorkflowExecutionInput {
  executionId: string;
}

export type RunOutcome = "completed" | "skipped";

export class WorkflowExecutionRunner {
  constructor(
    private readonly workflowExecutionStatusWriter: WorkflowExecutionStatusWriter,
    private readonly nodeExecutionUnitOfWork: NodeExecutionUnitOfWork,
    private readonly nodeExecutionReader: NodeExecutionReader,
    private readonly nodeWork: NodeWork,
    private readonly logger: Logger,
  ) {}

  // Safe to repeat: completed nodes are skipped, an interrupted node is redone.
  async run({ executionId }: RunWorkflowExecutionInput): Promise<RunOutcome> {
    const execution =
      await this.workflowExecutionStatusWriter.markWorkflowExecutionRunning(executionId);

    if (!execution) {
      return "skipped";
    }

    const steps = await this.nodeExecutionReader.getNodeExecutionSteps(executionId);

    for (const step of steps) {
      if (step.status !== NODE_EXECUTION_STATUS.COMPLETED) {
        await this.runStep(executionId, step);
      }
    }

    const completed =
      await this.workflowExecutionStatusWriter.markWorkflowExecutionCompleted(executionId);

    if (!completed) {
      throw new ExecutionStateConflictError("workflow execution was no longer RUNNING", {
        executionId,
      });
    }

    return "completed";
  }

  private async runStep(executionId: string, step: NodeExecutionStepRow): Promise<void> {
    const context = { executionId, nodeExecutionId: step.id };

    const { attempt, abandoned } = await this.nodeExecutionUnitOfWork.run(
      async ({ nodeExecutions }) => {
        const abandoned = await nodeExecutions.abandonRunningAttempts(step.id);
        const attempt = await nodeExecutions.createAttempt(step.id);

        if (!(await nodeExecutions.markNodeExecutionRunning(step.id))) {
          throw new ExecutionStateConflictError("node execution was no longer startable", context);
        }

        return { attempt, abandoned };
      },
    );

    if (abandoned > 0) {
      this.logger.warn(
        { ...context, node: step.name, abandoned },
        "resuming node after a lost worker",
      );
    }

    this.logger.info(
      { ...context, node: step.name, attemptNumber: attempt.attempt_number },
      "node started",
    );

    await this.nodeWork.perform({
      ...context,
      config: step.config,
      attemptNumber: attempt.attempt_number,
    });

    // Attempt first: a superseded attempt must never complete a node another worker owns.
    await this.nodeExecutionUnitOfWork.run(async ({ nodeExecutions }) => {
      if (!(await nodeExecutions.completeAttempt(attempt.id))) {
        throw new ExecutionStateConflictError("attempt was no longer RUNNING", {
          ...context,
          attemptNumber: attempt.attempt_number,
        });
      }

      if (!(await nodeExecutions.markNodeExecutionCompleted(step.id))) {
        throw new ExecutionStateConflictError("node execution was no longer RUNNING", context);
      }
    });

    this.logger.info(
      { ...context, node: step.name, attemptNumber: attempt.attempt_number },
      "node completed",
    );
  }
}
