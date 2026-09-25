import { z } from "zod";
import { workflowVersionSchema } from "@/schemas/workflowVersion.schemas.js";

// Used to create a version: the row doesn't exist yet, so the caller supplies the
// human-facing sequential number rather than an id.
export const createWorkflowVersionInputSchema = workflowVersionSchema.pick({
  workflowId: true,
  version: true,
});

export type CreateWorkflowVersionInput = z.infer<typeof createWorkflowVersionInputSchema>;

// Used to address an existing version (get/delete/publish, and node operations scoped to
// a version) — by its id, not its number.
export const workflowVersionRefSchema = z.object({
  workflowId: workflowVersionSchema.shape.workflowId,
  version: workflowVersionSchema.shape.id,
});

export type WorkflowVersionRef = z.infer<typeof workflowVersionRefSchema>;
