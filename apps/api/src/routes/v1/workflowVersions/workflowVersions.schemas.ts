import { z } from "zod";
import { v1SchemaRegistry, withIntFormat } from "../registry.js";

const versionNumberResponseSchema = withIntFormat(
  z.int32().positive().describe("Version number, unique within the workflow."),
  "int32",
);

export const workflowVersionResponseSchema = z.object({
  id: z.uuid().max(36).describe("Workflow version ID."),
  workflowId: z.uuid().max(36).describe("ID of the workflow this version belongs to."),
  version: versionNumberResponseSchema,
  status: z
    .enum(["DRAFT", "PUBLISHED"])
    .describe("DRAFT is editable; PUBLISHED is executable and frozen."),
  createdAt: z.iso.datetime().max(35).describe("When the version was created."),
  publishedAt: z.iso
    .datetime()
    .max(35)
    .nullable()
    .describe("When the version was published, or null while still a draft."),
});

v1SchemaRegistry.add(workflowVersionResponseSchema, { id: "WorkflowVersion" });

const versionNumberCreateSchema = withIntFormat(
  z.int32().positive().describe("Version number to create."),
  "int32",
);

export const createWorkflowVersionBodySchema = z.object({
  version: versionNumberCreateSchema,
});

export const workflowVersionParamsSchema = z.object({
  workflowId: z.uuid().max(36).describe("ID of the parent workflow."),
  // The version's id, not its sequential number — addressed by id like every other
  // resource; the number stays available as workflowVersionResponseSchema.version.
  version: z.uuid().max(36).describe("Workflow version ID."),
});
