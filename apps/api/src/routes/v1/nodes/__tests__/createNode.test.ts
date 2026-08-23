import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "../../../../../test/fixtures.js";

describe("POST /workflows/{workflowId}/versions/{version}/nodes", () => {
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

  it("creates a node and points Location at its flat address", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
      payload: { name: "Reserve Inventory", type: "inventory" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Reserve Inventory", sequence: 0 });
    expect(response.headers["location"]).toBe(`/api/v1/nodes/${response.json().id}`);
  });

  it("refuses to add a node once the version is published, with VERSION_NOT_DRAFT", async () => {
    const { workflow } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
      payload: { name: "Charge Payment", type: "payment" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_NOT_DRAFT");
  });
});
