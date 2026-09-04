import { z } from "zod";

export const createWorkflowInputSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowIdSchema = z.uuid();
