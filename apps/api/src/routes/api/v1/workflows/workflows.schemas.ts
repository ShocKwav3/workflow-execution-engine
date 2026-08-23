import { z } from "zod";

export const workflowResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createWorkflowBodySchema = z.object({
  name: z.string().trim().min(1),
});

export const workflowIdParamsSchema = z.object({
  workflowId: z.uuid(),
});
