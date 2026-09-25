import { z } from "zod";
import { nodeExecutionSchema } from "@/schemas/nodeExecution.schemas.js";
import { workflowExecutionSchema } from "@/schemas/workflowExecution.schemas.js";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowExecutionRefSchema = z.object({
  workflowId: workflowExecutionSchema.shape.workflowId,
  workflowExecutionId: workflowExecutionSchema.shape.id,
});

export type WorkflowExecutionRef = z.infer<typeof workflowExecutionRefSchema>;

export const getNodeExecutionInputSchema = nodeExecutionSchema.pick({
  nodeId: true,
  workflowExecutionId: true,
});

export type GetNodeExecutionInput = z.infer<typeof getNodeExecutionInputSchema>;
