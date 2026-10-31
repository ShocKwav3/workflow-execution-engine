import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedDraftVersion } from "@workflow-engine/core/test/fixtures.js";

describe("GET /nodes/{nodeId}", () => {
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

  it("addresses a created node at the URL its Location header gave", async () => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, []);
    const created = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/nodes`,
      payload: { name: "Reserve Inventory", type: "inventory", config: { durationSeconds: 3 } },
    });

    const response = await harness.app.inject({
      method: "GET",
      url: created.headers["location"] as string,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(created.json().id);
    expect(response.json().config).toEqual({ durationSeconds: 3 });
  });

  it("returns 404 for a node that doesn't exist", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/nodes/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 414 as problem details for a path parameter over the router limit", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/nodes/${"a".repeat(101)}`,
    });

    expect(response.statusCode).toBe(414);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status: 414, code: "FST_ERR_MAX_PARAM_LENGTH" });
  });
});
