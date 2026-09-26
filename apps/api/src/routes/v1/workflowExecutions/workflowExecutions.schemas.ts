import { workflowExecutionSchema } from "@workflow-engine/core/schemas/workflowExecution.schemas.js";
import { z } from "zod";
import { v1SchemaRegistry } from "@/routes/v1/registry.js";

const { id, workflowId, workflowVersionId, status, idempotencyKey } =
  workflowExecutionSchema.shape;

export const workflowExecutionResponseSchema = z.object({
  id: id.max(36).describe("Workflow execution ID."),
  workflowId: workflowId.max(36).describe("ID of the executed workflow."),
  workflowVersionId: workflowVersionId.max(36).describe("ID of the executed workflow version."),
  status: status.describe("Current execution status."),
  idempotencyKey: idempotencyKey
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
  workflowVersionId: workflowVersionId
    .max(36)
    .describe("ID of the published workflow version to execute."),
});

export const createWorkflowExecutionResponseSchema = z.object({
  executionId: id.max(36).describe("ID of the created execution."),
});

export const workflowExecutionParamsSchema = z.object({
  workflowId: workflowId.max(36).describe("ID of the parent workflow."),
  executionId: id.max(36).describe("Workflow execution ID."),
});
