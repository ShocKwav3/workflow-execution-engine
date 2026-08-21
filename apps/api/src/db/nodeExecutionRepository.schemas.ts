import { z } from "zod";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowExecutionIdSchema = z.uuid();

export const getNodeExecutionInputSchema = z.object({
  nodeId: z.uuid(),
  workflowExecutionId: z.uuid(),
});

export type GetNodeExecutionInput = z.infer<typeof getNodeExecutionInputSchema>;
