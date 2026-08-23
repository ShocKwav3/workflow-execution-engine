import { z } from "zod";

export const nodeIdSchema = z.uuid();

export const createNodeInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export type CreateNodeInput = z.infer<typeof createNodeInputSchema>;

export const updateNodeInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
  })
  .refine((input) => input.name !== undefined || input.type !== undefined, {
    message: "At least one of name or type must be provided",
  });

export type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>;

export const reorderNodesInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  nodeIds: z.array(z.uuid()).min(1),
});

export type ReorderNodesInput = z.infer<typeof reorderNodesInputSchema>;
