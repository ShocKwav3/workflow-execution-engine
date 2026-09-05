import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createStartWorkflowExecutionMessage,
  startWorkflowExecutionMessageSchema,
} from "@/amqp/messages/startWorkflowExecution.js";

const validMessage = {
  messageId: "6f1d0b4c-6d0e-4a5a-9a4f-6f2b0b1a7c11",
  correlationId: "0c9f2a3d-4b5e-4c6f-8a9b-1d2e3f4a5b6c",
  type: "StartWorkflowExecution",
  occurredAt: "2026-01-15T10:30:00.000Z",
  payload: {
    workflowExecutionId: "8e7d6c5b-4a39-4281-9f0e-1a2b3c4d5e6f",
  },
};

function rejectedPaths(message: unknown): string[] {
  try {
    startWorkflowExecutionMessageSchema.parse(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map((issue) => issue.path.join("."));
    }

    throw error;
  }

  throw new Error("expected the command to be rejected, but it parsed");
}

describe("startWorkflowExecutionMessageSchema", () => {
  it("accepts a well-formed command", () => {
    expect(startWorkflowExecutionMessageSchema.parse(validMessage)).toEqual(validMessage);
  });

  it.each([
    ["messageId", { ...validMessage, messageId: "not-a-uuid" }],
    ["correlationId", { ...validMessage, correlationId: "not-a-uuid" }],
    ["type", { ...validMessage, type: "StartWorkflow" }],
    ["occurredAt", { ...validMessage, occurredAt: "2026-01-15" }],
    [
      "payload.workflowExecutionId",
      { ...validMessage, payload: { workflowExecutionId: "not-a-uuid" } },
    ],
    ["payload", { ...validMessage, payload: undefined }],
  ])("rejects a malformed %s", (field, message) => {
    expect(rejectedPaths(message)).toEqual([field]);
  });
});

describe("createStartWorkflowExecutionMessage", () => {
  const workflowExecutionId = "8e7d6c5b-4a39-4281-9f0e-1a2b3c4d5e6f";

  it("builds a command that satisfies its own schema", () => {
    const message = createStartWorkflowExecutionMessage(workflowExecutionId);

    expect(startWorkflowExecutionMessageSchema.parse(message)).toEqual(message);
    expect(message.type).toBe("StartWorkflowExecution");
    expect(message.payload.workflowExecutionId).toBe(workflowExecutionId);
  });

  it("mints a distinct message id per command", () => {
    const first = createStartWorkflowExecutionMessage(workflowExecutionId);
    const second = createStartWorkflowExecutionMessage(workflowExecutionId);

    expect(first.messageId).not.toBe(second.messageId);
  });

  it("throws when the execution id is not a uuid", () => {
    const build = () => createStartWorkflowExecutionMessage("not-a-uuid");

    expect(build).toThrow(z.ZodError);
  });
});
