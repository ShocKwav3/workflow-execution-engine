import type { z } from "zod";
import { workflowExecutionSchema } from "@/schemas/workflowExecution.schemas.js";

// Client-supplied through the Idempotency-Key header, which no route schema validates.
export const idempotencyKeySchema = workflowExecutionSchema.shape.idempotencyKey.optional();

export const createWorkflowExecutionInputSchema = workflowExecutionSchema
  .pick({ workflowId: true, workflowVersionId: true })
  .extend({ idempotencyKey: idempotencyKeySchema });

export const createWorkflowExecutionRefSchema = createWorkflowExecutionInputSchema.omit({
  idempotencyKey: true,
});

export type CreateWorkflowExecutionInput = z.infer<typeof createWorkflowExecutionInputSchema>;
