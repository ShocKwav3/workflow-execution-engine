import { z } from "zod";

const nodeDefinitionSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const nodeResponseSchema = z.object({
  id: z.uuid(),
  workflowVersionId: z.uuid(),
  name: z.string(),
  type: z.string(),
  sequence: z.number().int(),
  createdAt: z.iso.datetime(),
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
  nodes: z.array(nodeResponseSchema),
  createdAt: z.iso.datetime(),
});

export const createWorkflowBodySchema = z.object({
  name: z.string().trim().min(1),
});

export const createWorkflowVersionBodySchema = z.object({
  version: z.number().int().positive(),
  definition: z.array(nodeDefinitionSchema).min(1),
});

export const workflowIdParamsSchema = z.object({
  workflowId: z.uuid(),
});

export const workflowVersionParamsSchema = z.object({
  workflowId: z.uuid(),
  version: z.coerce.number().int().positive(),
});

export const workflowExecutionParamsSchema = z.object({
  workflowId: z.uuid(),
  executionId: z.uuid(),
});

export const createWorkflowExecutionBodySchema = z.object({
  workflowVersionId: z.uuid(),
});

export const createWorkflowExecutionResponseSchema = z.object({
  executionId: z.uuid(),
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

export const nodeExecutionListItemResponseSchema = z.object({
  id: z.uuid(),
  workflowExecutionId: z.uuid(),
  nodeId: z.uuid(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
