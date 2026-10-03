import { z } from "zod";
import { nodeSchema } from "./node.schemas.js";
import { workflowExecutionSchema } from "./workflowExecution.schemas.js";

// PENDING is the column default; FAILED is deliberately absent — nothing fails a node yet.
export const nodeExecutionStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED"]);

export const NODE_EXECUTION_STATUS = nodeExecutionStatusSchema.enum;

export type NodeExecutionStatus = z.infer<typeof nodeExecutionStatusSchema>;

// ABANDONED marks an attempt whose worker was lost; FAILED arrives with failure handling.
export const nodeExecutionAttemptStatusSchema = z.enum(["RUNNING", "COMPLETED", "ABANDONED"]);

export const NODE_EXECUTION_ATTEMPT_STATUS = nodeExecutionAttemptStatusSchema.enum;

export type NodeExecutionAttemptStatus = z.infer<typeof nodeExecutionAttemptStatusSchema>;

export const nodeExecutionSchema = z.object({
  id: z.uuid(),
  workflowExecutionId: workflowExecutionSchema.shape.id,
  nodeId: nodeSchema.shape.id,
  status: nodeExecutionStatusSchema,
});

export const nodeExecutionAttemptSchema = z.object({
  id: z.uuid(),
  nodeExecutionId: nodeExecutionSchema.shape.id,
  attemptNumber: z.int32(),
  status: nodeExecutionAttemptStatusSchema,
});
