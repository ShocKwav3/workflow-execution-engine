import type { z } from "zod";
import { workflowExecutionSchema } from "@/schemas/workflowExecution.schemas.js";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const executionIdSchema = workflowExecutionSchema.shape.id;

// Client-supplied through the Idempotency-Key header, which no route schema validates.
export const idempotencyKeySchema = workflowExecutionSchema.shape.idempotencyKey.optional();

export const createWorkflowExecutionInputSchema = workflowExecutionSchema
  .pick({ workflowId: true, workflowVersionId: true })
  .extend({ idempotencyKey: idempotencyKeySchema });

export const createWorkflowExecutionRefSchema = createWorkflowExecutionInputSchema.omit({
  idempotencyKey: true,
});

export type CreateWorkflowExecutionInput = z.infer<typeof createWorkflowExecutionInputSchema>;
