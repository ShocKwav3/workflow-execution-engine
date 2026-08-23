import { z } from "zod";

export const nodeResponseSchema = z.object({
  id: z.uuid().describe("Node ID, globally unique."),
  workflowVersionId: z.uuid().describe("ID of the workflow version this node belongs to."),
  name: z.string().describe("Node name."),
  type: z.string().describe("Node type — determines what the node does when executed."),
  sequence: z
    .number()
    .int()
    .describe("Execution order within the workflow version, starting at 0."),
  createdAt: z.iso.datetime().describe("When the node was created."),
});

export const nodeIdParamsSchema = z.object({
  nodeId: z.uuid().describe("Node ID."),
});

export const createNodeBodySchema = z.object({
  name: z.string().trim().min(1).describe("Node name."),
  type: z
    .string()
    .trim()
    .min(1)
    .describe("Node type — determines what the node does when executed."),
});

export const updateNodeBodySchema = z
  .object({
    name: z.string().trim().min(1).optional().describe("New node name."),
    type: z.string().trim().min(1).optional().describe("New node type."),
  })
  .refine((body) => body.name !== undefined || body.type !== undefined, {
    message: "At least one of name or type must be provided",
  });

export const reorderNodesBodySchema = z.object({
  nodeIds: z
    .array(z.uuid())
    .min(1)
    .describe("All node IDs of the version, in the desired execution order."),
});
