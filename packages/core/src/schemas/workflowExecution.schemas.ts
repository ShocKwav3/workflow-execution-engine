import { z } from "zod";
import { workflowSchema } from "./workflow.schemas.js";
import { workflowVersionSchema } from "./workflowVersion.schemas.js";

// CREATED is the column default; FAILED is deliberately absent — nothing fails an execution yet.
export const workflowExecutionStatusSchema = z.enum(["CREATED", "RUNNING", "COMPLETED"]);

export const WORKFLOW_EXECUTION_STATUS = workflowExecutionStatusSchema.enum;

export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>;

export const workflowExecutionSchema = z.object({
  id: z.uuid(),
  workflowId: workflowSchema.shape.id,
  workflowVersionId: workflowVersionSchema.shape.id,
  status: workflowExecutionStatusSchema,
  idempotencyKey: z.string().trim().min(1),
});
