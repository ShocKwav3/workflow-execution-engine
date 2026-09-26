import { z } from "zod";
import { correlationIdSchema } from "./correlation.schemas.js";
import { workflowExecutionSchema } from "./workflowExecution.schemas.js";

export const WORKFLOW_EXECUTIONS_QUEUE = "workflow-executions";

export const START_WORKFLOW_EXECUTION = "StartWorkflowExecution";

// Non-strict on purpose: a consumer older than its producer must ignore fields added later.
export const startWorkflowExecutionJobSchema = z.object({
  schemaVersion: z.literal(1),
  executionId: workflowExecutionSchema.shape.id,
  correlationId: correlationIdSchema,
});

export type StartWorkflowExecutionJob = z.infer<typeof startWorkflowExecutionJobSchema>;
