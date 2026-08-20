import { z } from "zod";

export const workflowExecutionIdParamsSchema = z.object({
  id: z.uuid(),
});

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

export const stepExecutionResponseSchema = z.object({
  id: z.uuid(),
  workflowExecutionId: z.uuid(),
  stepName: z.string(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const stepAttemptResponseSchema = z.object({
  id: z.uuid(),
  stepExecutionId: z.uuid(),
  attemptNumber: z.number().int(),
  status: z.string(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});

export const workflowExecutionHistoryEntryResponseSchema = z.object({
  step: stepExecutionResponseSchema,
  attempts: z.array(stepAttemptResponseSchema),
});
