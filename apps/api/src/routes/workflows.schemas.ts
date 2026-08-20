import { z } from "zod";

const stepDefinitionSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const workflowResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const workflowVersionResponseSchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  definition: z.array(stepDefinitionSchema),
  createdAt: z.iso.datetime(),
});

export const createWorkflowBodySchema = z.object({
  name: z.string().trim().min(1),
});

export const createWorkflowVersionBodySchema = z.object({
  version: z.number().int().positive(),
  definition: z.array(stepDefinitionSchema).min(1),
});

export const workflowIdParamsSchema = z.object({
  id: z.uuid(),
});

export const workflowVersionParamsSchema = z.object({
  id: z.uuid(),
  version: z.coerce.number().int().positive(),
});

export const createExecutionBodySchema = z.object({
  workflowVersionId: z.uuid(),
});

export const createExecutionResponseSchema = z.object({
  executionId: z.uuid(),
});
