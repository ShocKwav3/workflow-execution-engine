import { describe, expect, it } from "vitest";
import { groupNodeHistoryRows, type NodeHistoryQueryRow } from "@/db/helpers/executionHistoryGrouping.js";

function row(overrides: Partial<NodeHistoryQueryRow>): NodeHistoryQueryRow {
  return {
    node_execution_id: "node-execution-1",
    workflow_execution_id: "exec-1",
    node_id: "node-1",
    node_name: "Reserve Inventory",
    node_type: "inventory",
    node_sequence: 0,
    node_execution_status: "PENDING",
    node_execution_created_at: new Date("2026-01-01T00:00:00Z"),
    node_execution_updated_at: new Date("2026-01-01T00:00:00Z"),
    attempt_id: null,
    attempt_number: null,
    attempt_status: null,
    started_at: null,
    finished_at: null,
    error: null,
    ...overrides,
  };
}

describe("groupNodeHistoryRows", () => {
  it("groups a node with no attempts into an empty attempts array", () => {
    const result = groupNodeHistoryRows([row({})]);

    expect(result).toEqual([
      {
        node: {
          id: "node-execution-1",
          workflow_execution_id: "exec-1",
          node_id: "node-1",
          name: "Reserve Inventory",
          type: "inventory",
          sequence: 0,
          status: "PENDING",
          created_at: new Date("2026-01-01T00:00:00Z"),
          updated_at: new Date("2026-01-01T00:00:00Z"),
        },
        attempts: [],
      },
    ]);
  });

  it("groups multiple attempt rows under the same node", () => {
    const rows = [
      row({
        attempt_id: "attempt-1",
        attempt_number: 1,
        attempt_status: "FAILED",
        error: "timeout",
      }),
      row({ attempt_id: "attempt-2", attempt_number: 2, attempt_status: "COMPLETED" }),
    ];

    const result = groupNodeHistoryRows(rows);

    expect(result).toHaveLength(1);
    expect(result[0]!.attempts).toHaveLength(2);
    expect(result[0]!.attempts.map((a) => a.attempt_number)).toEqual([1, 2]);
  });

  it("keeps separate nodes as separate entries", () => {
    const rows = [
      row({ node_execution_id: "node-execution-1" }),
      row({ node_execution_id: "node-execution-2", node_name: "Charge Payment" }),
    ];

    const result = groupNodeHistoryRows(rows);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.node.name)).toEqual(["Reserve Inventory", "Charge Payment"]);
  });

  it("returns an empty array for no rows", () => {
    expect(groupNodeHistoryRows([])).toEqual([]);
  });
});
