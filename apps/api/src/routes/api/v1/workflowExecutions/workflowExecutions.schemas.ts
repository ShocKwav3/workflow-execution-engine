import { z } from "zod";

export const workflowExecutionResponseSchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  workflowVersionId: z.uuid(),
  status: z.string(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export const createWorkflowExecutionBodySchema = z.object({
  workflowVersionId: z.uuid(),
});

export const createWorkflowExecutionResponseSchema = z.object({
  executionId: z.uuid(),
});

export const workflowExecutionParamsSchema = z.object({
  workflowId: z.uuid(),
  executionId: z.uuid(),
});
