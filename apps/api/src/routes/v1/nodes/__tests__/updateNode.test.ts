import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "@test/fixtures.js";

describe("PATCH /nodes/{nodeId}", () => {
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

  it("renames a node", async () => {
    const { nodes } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/nodes/${nodes[0]!.id}`,
      payload: { name: "Reserve Stock" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "Reserve Stock", type: "inventory" });
  });

  it("rejects an empty patch body", async () => {
    const { nodes } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/nodes/${nodes[0]!.id}`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("refuses to rename a node once the version is published, with VERSION_NOT_DRAFT", async () => {
    const { nodes } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/nodes/${nodes[0]!.id}`,
      payload: { name: "Renamed" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_NOT_DRAFT");
  });
});
