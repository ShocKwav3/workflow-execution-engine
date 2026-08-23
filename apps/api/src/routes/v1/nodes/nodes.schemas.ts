import { z } from "zod";

export const nodeResponseSchema = z.object({
  id: z.uuid(),
  workflowVersionId: z.uuid(),
  name: z.string(),
  type: z.string(),
  sequence: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const nodeIdParamsSchema = z.object({
  nodeId: z.uuid(),
});

export const createNodeBodySchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export const updateNodeBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
  })
  .refine((body) => body.name !== undefined || body.type !== undefined, {
    message: "At least one of name or type must be provided",
  });

export const reorderNodesBodySchema = z.object({
  nodeIds: z.array(z.uuid()).min(1),
});
