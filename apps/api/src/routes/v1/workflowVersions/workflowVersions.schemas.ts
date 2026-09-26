import { workflowVersionSchema } from "@workflow-engine/core/schemas/workflowVersion.schemas.js";
import { z } from "zod";
import { v1SchemaRegistry, withIntFormat } from "@/routes/v1/registry.js";

const { id, workflowId, version, status } = workflowVersionSchema.shape;

const versionNumberResponseSchema = withIntFormat(
  version.describe("Version number, unique within the workflow."),
  "int32",
);

export const workflowVersionResponseSchema = z.object({
  id: id.max(36).describe("Workflow version ID."),
  workflowId: workflowId.max(36).describe("ID of the workflow this version belongs to."),
  version: versionNumberResponseSchema,
  status: status.describe("DRAFT is editable; PUBLISHED is executable and frozen."),
  createdAt: z.iso.datetime().max(35).describe("When the version was created."),
  publishedAt: z.iso
    .datetime()
    .max(35)
    .nullable()
    .describe("When the version was published, or null while still a draft."),
});

v1SchemaRegistry.add(workflowVersionResponseSchema, { id: "WorkflowVersion" });

const versionNumberCreateSchema = withIntFormat(
  version.describe("Version number to create."),
  "int32",
);

export const createWorkflowVersionBodySchema = z.object({
  version: versionNumberCreateSchema,
});

export const workflowVersionParamsSchema = z.object({
  workflowId: workflowId.max(36).describe("ID of the parent workflow."),
  // The version's id, not its sequential number — addressed by id like every other
  // resource; the number stays available as workflowVersionResponseSchema.version.
  version: id.max(36).describe("Workflow version ID."),
});
