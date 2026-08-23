import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "../../../../../test/fixtures.js";

describe("DELETE /workflows/{workflowId}/versions/{version}", () => {
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

  it("deletes a draft version", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "DELETE",
      url: `/api/v1/workflows/${workflow.id}/versions/1`,
    });

    expect(response.statusCode).toBe(204);
  });

  it("refuses to delete a published version with VERSION_NOT_DRAFT", async () => {
    const { workflow } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "DELETE",
      url: `/api/v1/workflows/${workflow.id}/versions/1`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_NOT_DRAFT");
  });
});
