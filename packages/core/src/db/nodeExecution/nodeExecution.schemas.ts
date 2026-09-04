import { z } from "zod";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowExecutionRefSchema = z.object({
  workflowId: z.uuid(),
  workflowExecutionId: z.uuid(),
});

export type WorkflowExecutionRef = z.infer<typeof workflowExecutionRefSchema>;

export const getNodeExecutionInputSchema = z.object({
  nodeId: z.uuid(),
  workflowExecutionId: z.uuid(),
});

export type GetNodeExecutionInput = z.infer<typeof getNodeExecutionInputSchema>;
