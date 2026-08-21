import { z } from "zod";

export { nodeResponseSchema } from "../workflows/workflows.schemas.js";

export const nodeIdParamsSchema = z.object({
  nodeId: z.uuid(),
});

export const nodeExecutionParamsSchema = z.object({
  nodeId: z.uuid(),
  executionId: z.uuid(),
});

const nodeExecutionAttemptResponseSchema = z.object({
  id: z.uuid(),
  nodeExecutionId: z.uuid(),
  attemptNumber: z.number().int(),
  status: z.string(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});

export const nodeExecutionDetailResponseSchema = z.object({
  id: z.uuid(),
  workflowExecutionId: z.uuid(),
  nodeId: z.uuid(),
  name: z.string(),
  type: z.string(),
  sequence: z.number().int(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  attempts: z.array(nodeExecutionAttemptResponseSchema),
});
