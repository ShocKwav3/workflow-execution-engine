import { z } from "zod";
import { v1SchemaRegistry } from "../registry.js";

export const workflowResponseSchema = z.object({
  id: z.uuid().max(36).describe("Workflow ID."),
  name: z.string().max(255).describe("Workflow name."),
  createdAt: z.iso.datetime().max(35).describe("When the workflow was created."),
  updatedAt: z.iso.datetime().max(35).describe("When the workflow was last updated."),
});

v1SchemaRegistry.add(workflowResponseSchema, { id: "Workflow" });

export const createWorkflowBodySchema = z.object({
  name: z.string().trim().min(1).max(255).describe("Human-readable workflow name."),
});

export const workflowIdParamsSchema = z.object({
  workflowId: z.uuid().max(36).describe("Workflow ID."),
});
