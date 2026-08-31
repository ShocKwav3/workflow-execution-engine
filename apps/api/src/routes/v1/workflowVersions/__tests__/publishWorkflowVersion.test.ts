import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "@test/fixtures.js";

describe("POST /workflows/{workflowId}/versions/{version}/publish", () => {
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

  it("publishes a draft that has nodes", async () => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/publish`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("PUBLISHED");
    expect(response.json().publishedAt).not.toBeNull();
  });

  it("refuses to publish an empty draft with VERSION_HAS_NO_NODES", async () => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/publish`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ status: 409, code: "VERSION_HAS_NO_NODES" });
  });

  it("refuses to publish twice with VERSION_ALREADY_PUBLISHED", async () => {
    const { workflow, version } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/publish`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_ALREADY_PUBLISHED");
  });
});
