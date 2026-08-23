import { z } from "zod";

export const workflowVersionResponseSchema = z.object({
  id: z.uuid().describe("Workflow version ID."),
  workflowId: z.uuid().describe("ID of the workflow this version belongs to."),
  version: z.number().int().positive().describe("Version number, unique within the workflow."),
  status: z
    .enum(["DRAFT", "PUBLISHED"])
    .describe("DRAFT is editable; PUBLISHED is executable and frozen."),
  createdAt: z.iso.datetime().describe("When the version was created."),
  publishedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the version was published, or null while still a draft."),
});

export const createWorkflowVersionBodySchema = z.object({
  version: z.number().int().positive().describe("Version number to create."),
});

export const workflowVersionParamsSchema = z.object({
  workflowId: z.uuid().describe("ID of the parent workflow."),
  version: z.coerce.number().int().positive().describe("Version number."),
});
