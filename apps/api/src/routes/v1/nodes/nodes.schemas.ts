import { nodeSchema } from "@workflow-engine/core/schemas/node.schemas.js";
import { atLeastOneOf } from "@workflow-engine/core/schemas/refinements.js";
import { z } from "zod";
import { v1SchemaRegistry, withIntFormat } from "@/routes/v1/registry.js";

const { id, workflowVersionId, name, type, sequence } = nodeSchema.shape;

const sequenceSchema = withIntFormat(
  sequence.describe("Execution order within the workflow version, starting at 0."),
  "int32",
);

export const nodeResponseSchema = z.object({
  id: id.max(36).describe("Node ID, globally unique."),
  workflowVersionId: workflowVersionId
    .max(36)
    .describe("ID of the workflow version this node belongs to."),
  name: name.max(255).describe("Node name."),
  type: type.max(100).describe("Node type — determines what the node does when executed."),
  sequence: sequenceSchema,
  createdAt: z.iso.datetime().max(35).describe("When the node was created."),
});

v1SchemaRegistry.add(nodeResponseSchema, { id: "Node" });

export const nodeIdParamsSchema = z.object({
  nodeId: id.max(36).describe("Node ID."),
});

export const createNodeBodySchema = z.object({
  name: name.max(255).describe("Node name."),
  type: type.max(100).describe("Node type — determines what the node does when executed."),
});

export const updateNodeBodySchema = z
  .object({
    name: name.max(255).optional().describe("New node name."),
    type: type.max(100).optional().describe("New node type."),
  })
  .refine(...atLeastOneOf(["name", "type"]));

export const reorderNodesBodySchema = z.object({
  nodeIds: z
    .array(id.max(36))
    .min(1)
    .max(1000)
    .describe("All node IDs of the version, in the desired execution order."),
});
