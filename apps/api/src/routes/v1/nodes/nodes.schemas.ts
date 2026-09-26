import { nodeConfigSchema, nodeSchema } from "@workflow-engine/core/schemas/node.schemas.js";
import { atLeastOneOf } from "@workflow-engine/core/schemas/refinements.js";
import { z } from "zod";
import { v1SchemaRegistry, withIntFormat } from "@/routes/v1/registry.js";

const { id, workflowVersionId, name, type, sequence, config } = nodeSchema.shape;
const { durationSeconds, crash } = nodeConfigSchema.shape;

// Nested config fields are core's own instances, so OpenAPI metadata attaches via the registry.
v1SchemaRegistry.add(durationSeconds.unwrap(), {
  format: "int32",
  description: "Seconds the node's simulated work takes. Treated as 0 when omitted.",
});
v1SchemaRegistry.add(crash.unwrap(), {
  description: "Deliberate crash injection, for failure testing.",
});
v1SchemaRegistry.add(crash.unwrap().shape.duringRetry.unwrap(), {
  format: "int32",
  description: "Crash the executor while running this attempt (0 = first attempt).",
});

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
  config: config.describe("Node configuration, exactly as submitted."),
  createdAt: z.iso.datetime().max(35).describe("When the node was created."),
});

v1SchemaRegistry.add(nodeResponseSchema, { id: "Node" });

export const nodeIdParamsSchema = z.object({
  nodeId: id.max(36).describe("Node ID."),
});

export const createNodeBodySchema = z.object({
  name: name.max(255).describe("Node name."),
  type: type.max(100).describe("Node type — determines what the node does when executed."),
  config: config
    .optional()
    .describe("Node configuration. Unknown keys are rejected. Stored as {} when omitted."),
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
