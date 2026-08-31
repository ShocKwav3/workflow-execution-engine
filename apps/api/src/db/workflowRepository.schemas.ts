import { z } from "zod";

export const createWorkflowInputSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;

// Used to create a version: the row doesn't exist yet, so the caller supplies the
// human-facing sequential number rather than an id.
export const createWorkflowVersionInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
});

export type CreateWorkflowVersionInput = z.infer<typeof createWorkflowVersionInputSchema>;

// Used to address an existing version (get/delete/publish, and node operations scoped to
// a version) — by its id, not its number.
export const workflowVersionRefSchema = z.object({
  workflowId: z.uuid(),
  version: z.uuid(),
});

export type WorkflowVersionRef = z.infer<typeof workflowVersionRefSchema>;

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowIdSchema = z.uuid();
