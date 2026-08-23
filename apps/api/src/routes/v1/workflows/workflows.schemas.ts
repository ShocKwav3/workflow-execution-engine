import { z } from "zod";

export const workflowResponseSchema = z.object({
  id: z.uuid().describe("Workflow ID."),
  name: z.string().describe("Workflow name."),
  createdAt: z.iso.datetime().describe("When the workflow was created."),
  updatedAt: z.iso.datetime().describe("When the workflow was last updated."),
});

export const createWorkflowBodySchema = z.object({
  name: z.string().trim().min(1).describe("Human-readable workflow name."),
});

export const workflowIdParamsSchema = z.object({
  workflowId: z.uuid().describe("Workflow ID."),
});
