import { z } from "zod";
import { nodeSchema } from "@/schemas/node.schemas.js";
import { atLeastOneOf } from "@/schemas/refinements.js";
import { workflowVersionRefSchema } from "../workflowVersion/workflowVersion.schemas.js";

export const nodeIdSchema = nodeSchema.shape.id;

export const createNodeInputSchema = workflowVersionRefSchema.extend({
  ...nodeSchema.pick({ name: true, type: true }).shape,
  config: nodeSchema.shape.config.optional(),
});

export type CreateNodeInput = z.infer<typeof createNodeInputSchema>;

export const updateNodeInputSchema = nodeSchema
  .pick({ name: true, type: true })
  .partial()
  .refine(...atLeastOneOf(["name", "type"]));

export type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>;

export const reorderNodesInputSchema = workflowVersionRefSchema.extend({
  nodeIds: z.array(nodeSchema.shape.id).min(1),
});

export type ReorderNodesInput = z.infer<typeof reorderNodesInputSchema>;
