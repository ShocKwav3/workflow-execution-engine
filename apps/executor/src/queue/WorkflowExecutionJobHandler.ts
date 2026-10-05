import type { Logger } from "@workflow-engine/core/logging/types.js";
import {
  type StartWorkflowExecutionJob,
  startWorkflowExecutionJobContract,
} from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import type { RunOutcome, WorkflowExecutionRunner } from "../run/WorkflowExecutionRunner.js";
import type { JobContext, JobHandler } from "./JobHandler.js";

export class WorkflowExecutionJobHandler implements JobHandler<
  StartWorkflowExecutionJob,
  RunOutcome
> {
  readonly contract = startWorkflowExecutionJobContract;

  constructor(
    private readonly runner: WorkflowExecutionRunner,
    private readonly logger: Logger,
  ) {}

  // The only place jobId, executionId and correlationId appear together in the logs.
  async handle(
    { executionId, correlationId }: StartWorkflowExecutionJob,
    { jobId }: JobContext,
  ): Promise<RunOutcome> {
    const ids = { jobId, executionId, correlationId };

    this.logger.info(ids, "workflow execution started");

    // A thrown error is logged once, by the consumer, under the same jobId.
    const outcome = await this.runner.run({ executionId });

    this.logger.info({ ...ids, outcome }, "workflow execution finished");

    return outcome;
  }
}
