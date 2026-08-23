import { z } from "zod";

export const workflowExecutionResponseSchema = z.object({
  id: z.uuid().describe("Workflow execution ID."),
  workflowId: z.uuid().describe("ID of the executed workflow."),
  workflowVersionId: z.uuid().describe("ID of the executed workflow version."),
  status: z.string().describe("Current execution status."),
  idempotencyKey: z
    .string()
    .nullable()
    .describe("Idempotency key the execution was created with, if any."),
  createdAt: z.iso.datetime().describe("When the execution was created."),
  updatedAt: z.iso.datetime().describe("When the execution was last updated."),
  completedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the execution completed, or null while still running."),
});

export const createWorkflowExecutionBodySchema = z.object({
  workflowVersionId: z.uuid().describe("ID of the published workflow version to execute."),
});

export const createWorkflowExecutionResponseSchema = z.object({
  executionId: z.uuid().describe("ID of the created execution."),
});

export const workflowExecutionParamsSchema = z.object({
  workflowId: z.uuid().describe("ID of the parent workflow."),
  executionId: z.uuid().describe("Workflow execution ID."),
});
