import { z } from "zod";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const executionIdSchema = z.uuid();

// Client-supplied through the Idempotency-Key header, which no route schema validates.
export const idempotencyKeySchema = z.string().trim().min(1).optional();

export const createExecutionInputSchema = z.object({
  workflowId: z.uuid(),
  workflowVersionId: z.uuid(),
  idempotencyKey: idempotencyKeySchema,
});

export const createExecutionRefSchema = createExecutionInputSchema.omit({ idempotencyKey: true });

export type CreateExecutionInput = z.infer<typeof createExecutionInputSchema>;
