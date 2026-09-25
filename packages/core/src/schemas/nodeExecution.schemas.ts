import { z } from "zod";
import { nodeSchema } from "./node.schemas.js";
import { workflowExecutionSchema } from "./workflowExecution.schemas.js";

export const nodeExecutionSchema = z.object({
  id: z.uuid(),
  workflowExecutionId: workflowExecutionSchema.shape.id,
  nodeId: nodeSchema.shape.id,
});

export const nodeExecutionAttemptSchema = z.object({
  id: z.uuid(),
  nodeExecutionId: nodeExecutionSchema.shape.id,
  attemptNumber: z.int32(),
});
