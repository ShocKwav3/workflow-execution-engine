import { z } from "zod";
import { v1SchemaRegistry, withIntFormat } from "@/routes/v1/registry.js";

const sequenceSchema = withIntFormat(
  z.int32().describe("Execution order within the workflow version, starting at 0."),
  "int32",
);

export const nodeResponseSchema = z.object({
  id: z.uuid().max(36).describe("Node ID, globally unique."),
  workflowVersionId: z.uuid().max(36).describe("ID of the workflow version this node belongs to."),
  name: z.string().max(255).describe("Node name."),
  type: z.string().max(100).describe("Node type — determines what the node does when executed."),
  sequence: sequenceSchema,
  createdAt: z.iso.datetime().max(35).describe("When the node was created."),
});

v1SchemaRegistry.add(nodeResponseSchema, { id: "Node" });

export const nodeIdParamsSchema = z.object({
  nodeId: z.uuid().max(36).describe("Node ID."),
});

export const createNodeBodySchema = z.object({
  name: z.string().trim().min(1).max(255).describe("Node name."),
  type: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Node type — determines what the node does when executed."),
});

export const updateNodeBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional().describe("New node name."),
    type: z.string().trim().min(1).max(100).optional().describe("New node type."),
  })
  .refine((body) => body.name !== undefined || body.type !== undefined, {
    message: "At least one of name or type must be provided",
  });

export const reorderNodesBodySchema = z.object({
  nodeIds: z
    .array(z.uuid().max(36))
    .min(1)
    .max(1000)
    .describe("All node IDs of the version, in the desired execution order."),
});
