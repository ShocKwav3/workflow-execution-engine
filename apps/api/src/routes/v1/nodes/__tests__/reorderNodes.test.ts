import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion } from "../../../../../test/fixtures.js";

describe("PUT /workflows/{workflowId}/versions/{version}/nodes", () => {
  let harness: RouteHarness;

  beforeAll(async () => {
    harness = await startRouteHarness();
  }, 60_000);

  afterAll(async () => {
    await stopRouteHarness(harness);
  });

  beforeEach(async () => {
    await resetRouteHarness(harness);
  });

  it("reorders the collection", async () => {
    const { workflow, nodes } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const response = await harness.app.inject({
      method: "PUT",
      url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
      payload: { nodeIds: [nodes[1]!.id, nodes[0]!.id] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((node: { name: string }) => node.name)).toEqual([
      "Charge Payment",
      "Reserve Inventory",
    ]);
  });

  it("refuses a partial reorder with NODE_ORDERING_MISMATCH", async () => {
    const { workflow, nodes } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const response = await harness.app.inject({
      method: "PUT",
      url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
      payload: { nodeIds: [nodes[0]!.id] },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("NODE_ORDERING_MISMATCH");
  });
});
