import { z } from "zod";

export const createWorkflowInputSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;

const stepDefinitionSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export const createWorkflowVersionInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  definition: z.array(stepDefinitionSchema),
});

export type CreateWorkflowVersionInput = z.infer<typeof createWorkflowVersionInputSchema>;

// Lookup-key shape checks for read methods — not data-integrity validation (nothing
// is being written), just fail predictably on a malformed key instead of leaking a
// raw Postgres type-cast error (e.g. "invalid input syntax for type uuid").
export const workflowIdSchema = z.uuid();

export const getWorkflowVersionInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
});

export type GetWorkflowVersionInput = z.infer<typeof getWorkflowVersionInputSchema>;
