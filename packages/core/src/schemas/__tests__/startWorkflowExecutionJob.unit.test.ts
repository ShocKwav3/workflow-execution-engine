import { describe, expect, it } from "vitest";
import { startWorkflowExecutionJobSchema } from "@/schemas/startWorkflowExecutionJob.schemas.js";

const validJob = {
  schemaVersion: 1,
  executionId: "0b8e6f2a-4c3d-4e5f-8a9b-1c2d3e4f5a6b",
  correlationId: "3f6c1a2e-8b4d-4c1e-9a7f-2d5e6b8c9a01",
};

describe("startWorkflowExecutionJobSchema", () => {
  it("accepts a valid job unchanged", () => {
    expect(startWorkflowExecutionJobSchema.parse(validJob)).toEqual(validJob);
  });

  it("accepts and drops a field it does not know", () => {
    expect(startWorkflowExecutionJobSchema.parse({ ...validJob, priority: 5 })).toEqual(validJob);
  });

  it.each(["schemaVersion", "executionId", "correlationId"])("rejects a missing %s", (field) => {
    const job = Object.fromEntries(Object.entries(validJob).filter(([key]) => key !== field));

    expect(startWorkflowExecutionJobSchema.safeParse(job).success).toBe(false);
  });

  it.each([
    ["an unknown schemaVersion", { schemaVersion: 2 }],
    ["a string schemaVersion", { schemaVersion: "1" }],
    ["a non-UUID executionId", { executionId: "not-a-uuid" }],
    ["a non-UUID correlationId", { correlationId: "req-1" }],
    ["an empty correlationId", { correlationId: "" }],
    ["a non-string correlationId", { correlationId: 42 }],
  ])("rejects %s", (_label, override) => {
    expect(startWorkflowExecutionJobSchema.safeParse({ ...validJob, ...override }).success).toBe(
      false,
    );
  });
});
