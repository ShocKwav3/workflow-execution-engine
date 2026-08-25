import { z } from "zod";
import { v1SchemaRegistry } from "../registry.js";

export const workflowExecutionResponseSchema = z.object({
  id: z.uuid().max(36).describe("Workflow execution ID."),
  workflowId: z.uuid().max(36).describe("ID of the executed workflow."),
  workflowVersionId: z.uuid().max(36).describe("ID of the executed workflow version."),
  status: z.string().max(50).describe("Current execution status."),
  idempotencyKey: z
    .string()
    .max(255)
    .nullable()
    .describe("Idempotency key the execution was created with, if any."),
  createdAt: z.iso.datetime().max(35).describe("When the execution was created."),
  updatedAt: z.iso.datetime().max(35).describe("When the execution was last updated."),
  completedAt: z.iso
    .datetime()
    .max(35)
    .nullable()
    .describe("When the execution completed, or null while still running."),
});

v1SchemaRegistry.add(workflowExecutionResponseSchema, { id: "WorkflowExecution" });

export const createWorkflowExecutionBodySchema = z.object({
  workflowVersionId: z.uuid().max(36).describe("ID of the published workflow version to execute."),
});

export const createWorkflowExecutionResponseSchema = z.object({
  executionId: z.uuid().max(36).describe("ID of the created execution."),
});

export const workflowExecutionParamsSchema = z.object({
  workflowId: z.uuid().max(36).describe("ID of the parent workflow."),
  executionId: z.uuid().max(36).describe("Workflow execution ID."),
});
