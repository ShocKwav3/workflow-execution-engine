import { z } from "zod";
import { correlationIdSchema } from "./correlation.schemas.js";
import { defineJobContract } from "./jobContract.js";
import { workflowExecutionSchema } from "./workflowExecution.schemas.js";

// Non-strict on purpose: a consumer older than its producer must ignore fields added later.
export const startWorkflowExecutionJobSchema = z.object({
  schemaVersion: z.literal(1),
  executionId: workflowExecutionSchema.shape.id,
  correlationId: correlationIdSchema,
});

export type StartWorkflowExecutionJob = z.infer<typeof startWorkflowExecutionJobSchema>;

// The job name doubles as the outbox message_type; the queue name cannot contain ":".
export const startWorkflowExecutionJobContract = defineJobContract({
  queueName: "workflow-executions",
  jobName: "StartWorkflowExecution",
  schema: startWorkflowExecutionJobSchema,
});
