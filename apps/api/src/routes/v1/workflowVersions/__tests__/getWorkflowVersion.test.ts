import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion } from "../../../../../test/fixtures.js";

describe("GET /workflows/{workflowId}/versions/{version}", () => {
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

  it("fetches a version without embedding its nodes", async () => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).not.toHaveProperty("nodes");
  });

  it("returns 404 for a version that doesn't exist", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "GET",
      // Nil UUID: valid shape, guaranteed not to exist.
      url: `/api/v1/workflows/${workflow.id}/versions/00000000-0000-0000-0000-000000000000`,
    });

    expect(response.statusCode).toBe(404);
  });
});
