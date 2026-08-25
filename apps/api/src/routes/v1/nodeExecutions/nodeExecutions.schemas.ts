import { z } from "zod";
import { v1SchemaRegistry, withIntFormat } from "../registry.js";

export const nodeExecutionListItemResponseSchema = z.object({
  id: z.uuid().max(36).describe("Node execution ID."),
  workflowExecutionId: z.uuid().max(36).describe("ID of the parent workflow execution."),
  nodeId: z.uuid().max(36).describe("ID of the executed node."),
  status: z.string().max(50).describe("Current node execution status."),
  createdAt: z.iso.datetime().max(35).describe("When the node execution was created."),
  updatedAt: z.iso.datetime().max(35).describe("When the node execution was last updated."),
});

v1SchemaRegistry.add(nodeExecutionListItemResponseSchema, { id: "NodeExecutionListItem" });

const attemptNumberSchema = withIntFormat(
  z.int32().describe("Attempt number, starting at 1."),
  "int32",
);

const nodeExecutionAttemptResponseSchema = z.object({
  id: z.uuid().max(36).describe("Attempt ID."),
  nodeExecutionId: z.uuid().max(36).describe("ID of the parent node execution."),
  attemptNumber: attemptNumberSchema,
  status: z.string().max(50).describe("Outcome of this attempt."),
  startedAt: z.iso
    .datetime()
    .max(35)
    .nullable()
    .describe("When the attempt started, or null if not yet started."),
  finishedAt: z.iso
    .datetime()
    .max(35)
    .nullable()
    .describe("When the attempt finished, or null if still running."),
  error: z
    .string()
    .max(2000)
    .nullable()
    .describe("Error message if the attempt failed, otherwise null."),
});

const detailSequenceSchema = withIntFormat(
  z.int32().describe("Execution order within the workflow version."),
  "int32",
);

export const nodeExecutionDetailResponseSchema = z.object({
  id: z.uuid().max(36).describe("Node execution ID."),
  workflowExecutionId: z.uuid().max(36).describe("ID of the parent workflow execution."),
  nodeId: z.uuid().max(36).describe("ID of the executed node."),
  name: z.string().max(255).describe("Node name, snapshotted at execution time."),
  type: z.string().max(100).describe("Node type, snapshotted at execution time."),
  sequence: detailSequenceSchema,
  status: z.string().max(50).describe("Current node execution status."),
  createdAt: z.iso.datetime().max(35).describe("When the node execution was created."),
  updatedAt: z.iso.datetime().max(35).describe("When the node execution was last updated."),
  attempts: z
    .array(nodeExecutionAttemptResponseSchema)
    .max(50)
    .describe("Every attempt made for this node execution, in order."),
});

v1SchemaRegistry.add(nodeExecutionDetailResponseSchema, { id: "NodeExecutionDetail" });

export const nodeExecutionParamsSchema = z.object({
  nodeId: z.uuid().max(36).describe("ID of the node."),
  executionId: z.uuid().max(36).describe("ID of the workflow execution."),
});
