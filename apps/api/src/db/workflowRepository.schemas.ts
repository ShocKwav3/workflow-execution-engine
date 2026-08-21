import { z } from "zod";

export const createWorkflowInputSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;

const nodeDefinitionSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export const createWorkflowVersionInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  definition: z.array(nodeDefinitionSchema),
});

export type CreateWorkflowVersionInput = z.infer<typeof createWorkflowVersionInputSchema>;

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowIdSchema = z.uuid();

export const getWorkflowVersionInputSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
});

export type GetWorkflowVersionInput = z.infer<typeof getWorkflowVersionInputSchema>;
