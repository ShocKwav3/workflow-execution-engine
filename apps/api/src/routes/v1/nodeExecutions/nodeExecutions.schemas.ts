import { z } from "zod";

export const nodeExecutionListItemResponseSchema = z.object({
  id: z.uuid().describe("Node execution ID."),
  workflowExecutionId: z.uuid().describe("ID of the parent workflow execution."),
  nodeId: z.uuid().describe("ID of the executed node."),
  status: z.string().describe("Current node execution status."),
  createdAt: z.iso.datetime().describe("When the node execution was created."),
  updatedAt: z.iso.datetime().describe("When the node execution was last updated."),
});

const nodeExecutionAttemptResponseSchema = z.object({
  id: z.uuid().describe("Attempt ID."),
  nodeExecutionId: z.uuid().describe("ID of the parent node execution."),
  attemptNumber: z.number().int().describe("Attempt number, starting at 1."),
  status: z.string().describe("Outcome of this attempt."),
  startedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the attempt started, or null if not yet started."),
  finishedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the attempt finished, or null if still running."),
  error: z.string().nullable().describe("Error message if the attempt failed, otherwise null."),
});

export const nodeExecutionDetailResponseSchema = z.object({
  id: z.uuid().describe("Node execution ID."),
  workflowExecutionId: z.uuid().describe("ID of the parent workflow execution."),
  nodeId: z.uuid().describe("ID of the executed node."),
  name: z.string().describe("Node name, snapshotted at execution time."),
  type: z.string().describe("Node type, snapshotted at execution time."),
  sequence: z.number().int().describe("Execution order within the workflow version."),
  status: z.string().describe("Current node execution status."),
  createdAt: z.iso.datetime().describe("When the node execution was created."),
  updatedAt: z.iso.datetime().describe("When the node execution was last updated."),
  attempts: z
    .array(nodeExecutionAttemptResponseSchema)
    .describe("Every attempt made for this node execution, in order."),
});

export const nodeExecutionParamsSchema = z.object({
  nodeId: z.uuid().describe("ID of the node."),
  executionId: z.uuid().describe("ID of the workflow execution."),
});
