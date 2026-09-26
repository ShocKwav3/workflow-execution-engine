import { z } from "zod";
import { nodeSchema } from "./node.schemas.js";
import { workflowExecutionSchema } from "./workflowExecution.schemas.js";

// PENDING is the column default; FAILED is deliberately absent — nothing fails a node yet.
export const nodeExecutionStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED"]);

export const NODE_EXECUTION_STATUS = nodeExecutionStatusSchema.enum;

export type NodeExecutionStatus = z.infer<typeof nodeExecutionStatusSchema>;

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
});
