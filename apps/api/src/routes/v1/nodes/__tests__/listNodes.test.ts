import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion } from "../../../../../test/fixtures.js";

describe("GET /workflows/{workflowId}/versions/{version}/nodes", () => {
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

  it("lists a version's nodes in sequence order", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((node: { name: string }) => node.name)).toEqual([
      "Reserve Inventory",
      "Charge Payment",
    ]);
  });
});
