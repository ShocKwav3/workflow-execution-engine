import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "@workflow-engine/core/test/fixtures.js";

describe("DELETE /nodes/{nodeId}", () => {
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

  it("deletes a node", async () => {
    const { nodes } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "DELETE",
      url: `/api/v1/nodes/${nodes[0]!.id}`,
    });

    expect(response.statusCode).toBe(204);
  });

  it("refuses to delete a node once the version is published, with VERSION_NOT_DRAFT", async () => {
    const { nodes } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "DELETE",
      url: `/api/v1/nodes/${nodes[0]!.id}`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_NOT_DRAFT");
  });
});
