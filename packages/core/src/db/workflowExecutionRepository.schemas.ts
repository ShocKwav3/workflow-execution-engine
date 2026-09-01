import { z } from "zod";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const executionIdSchema = z.uuid();

export const createExecutionInputSchema = z.object({
  workflowId: z.uuid(),
  workflowVersionId: z.uuid(),
  idempotencyKey: z.string().trim().min(1).optional(),
});

export type CreateExecutionInput = z.infer<typeof createExecutionInputSchema>;
