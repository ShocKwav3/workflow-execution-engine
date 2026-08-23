import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "../../../../../test/fixtures.js";

describe("node routes", () => {
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

  it("addresses a created node at the URL its Location header gave", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, []);
    const created = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
      payload: { name: "Reserve Inventory", type: "inventory" },
    });

    const response = await harness.app.inject({
      method: "GET",
      url: created.headers["location"] as string,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(created.json().id);
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

  it("returns 404 for a node that doesn't exist", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/nodes/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
  });

  describe("once the version is published", () => {
    it("refuses every write with VERSION_NOT_DRAFT", async () => {
      const { workflow, nodes } = await seedPublishedVersion(harness.db.pool, [
        { name: "Reserve Inventory", type: "inventory" },
      ]);

      const create = await harness.app.inject({
        method: "POST",
        url: `/api/v1/workflows/${workflow.id}/versions/1/nodes`,
        payload: { name: "Charge Payment", type: "payment" },
      });
      const patch = await harness.app.inject({
        method: "PATCH",
        url: `/api/v1/nodes/${nodes[0]!.id}`,
        payload: { name: "Renamed" },
      });
      const remove = await harness.app.inject({
        method: "DELETE",
        url: `/api/v1/nodes/${nodes[0]!.id}`,
      });

      for (const response of [create, patch, remove]) {
        expect(response.statusCode).toBe(409);
        expect(response.json().code).toBe("VERSION_NOT_DRAFT");
      }
    });
  });
});
