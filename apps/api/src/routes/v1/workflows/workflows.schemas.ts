import { workflowSchema } from "@workflow-engine/core/schemas/workflow.schemas.js";
import { z } from "zod";
import { v1SchemaRegistry } from "@/routes/v1/registry.js";

const { id, name } = workflowSchema.shape;

export const workflowResponseSchema = z.object({
  id: id.max(36).describe("Workflow ID."),
  name: name.max(255).describe("Workflow name."),
  createdAt: z.iso.datetime().max(35).describe("When the workflow was created."),
  updatedAt: z.iso.datetime().max(35).describe("When the workflow was last updated."),
});

v1SchemaRegistry.add(workflowResponseSchema, { id: "Workflow" });

export const createWorkflowBodySchema = z.object({
  name: name.max(255).describe("Human-readable workflow name."),
});

export const workflowIdParamsSchema = z.object({
  workflowId: id.max(36).describe("Workflow ID."),
});
