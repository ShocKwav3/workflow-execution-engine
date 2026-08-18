import { describe, expect, it } from "vitest";
import { groupStepHistoryRows, type StepHistoryQueryRow } from "../executionHistoryGrouping.js";

function row(overrides: Partial<StepHistoryQueryRow>): StepHistoryQueryRow {
  return {
    step_id: "step-1",
    workflow_execution_id: "exec-1",
    step_name: "Reserve Inventory",
    step_status: "PENDING",
    step_created_at: new Date("2026-01-01T00:00:00Z"),
    step_updated_at: new Date("2026-01-01T00:00:00Z"),
    attempt_id: null,
    attempt_number: null,
    attempt_status: null,
    started_at: null,
    finished_at: null,
    error: null,
    ...overrides,
  };
}

describe("groupStepHistoryRows", () => {
  it("groups a step with no attempts into an empty attempts array", () => {
    const result = groupStepHistoryRows([row({})]);

    expect(result).toEqual([
      {
        step: {
          id: "step-1",
          workflow_execution_id: "exec-1",
          step_name: "Reserve Inventory",
          status: "PENDING",
          created_at: new Date("2026-01-01T00:00:00Z"),
          updated_at: new Date("2026-01-01T00:00:00Z"),
        },
        attempts: [],
      },
    ]);
  });

  it("groups multiple attempt rows under the same step", () => {
    const rows = [
      row({
        attempt_id: "attempt-1",
        attempt_number: 1,
        attempt_status: "FAILED",
        error: "timeout",
      }),
      row({ attempt_id: "attempt-2", attempt_number: 2, attempt_status: "COMPLETED" }),
    ];

    const result = groupStepHistoryRows(rows);

    expect(result).toHaveLength(1);
    expect(result[0]!.attempts).toHaveLength(2);
    expect(result[0]!.attempts.map((a) => a.attempt_number)).toEqual([1, 2]);
  });

  it("keeps separate steps as separate entries", () => {
    const rows = [
      row({ step_id: "step-1" }),
      row({ step_id: "step-2", step_name: "Charge Payment" }),
    ];

    const result = groupStepHistoryRows(rows);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.step.step_name)).toEqual([
      "Reserve Inventory",
      "Charge Payment",
    ]);
  });

  it("returns an empty array for no rows", () => {
    expect(groupStepHistoryRows([])).toEqual([]);
  });
});
