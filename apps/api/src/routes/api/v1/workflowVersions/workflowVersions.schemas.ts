import { z } from "zod";

export const workflowVersionResponseSchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  createdAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
});

export const createWorkflowVersionBodySchema = z.object({
  version: z.number().int().positive(),
});

export const workflowVersionParamsSchema = z.object({
  workflowId: z.uuid(),
  version: z.coerce.number().int().positive(),
});
