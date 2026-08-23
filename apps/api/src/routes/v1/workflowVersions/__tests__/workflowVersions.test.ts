import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "../../../../../test/fixtures.js";

describe("workflow version routes", () => {
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

  it("creates a version as an empty draft", async () => {
    const workflow = await harness.app.inject({
      method: "POST",
      url: "/api/v1/workflows",
      payload: { name: "Order Fulfillment" },
    });
    const { id } = workflow.json();

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${id}/versions`,
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ version: 1, status: "DRAFT", publishedAt: null });
  });

  it("fetches a version without embedding its nodes", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/versions/1`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).not.toHaveProperty("nodes");
  });

  it("publishes a draft that has nodes", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/1/publish`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("PUBLISHED");
    expect(response.json().publishedAt).not.toBeNull();
  });

  it("refuses to publish an empty draft with VERSION_HAS_NO_NODES", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/1/publish`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ status: 409, code: "VERSION_HAS_NO_NODES" });
  });

  it("refuses to publish twice with VERSION_ALREADY_PUBLISHED", async () => {
    const { workflow } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/1/publish`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_ALREADY_PUBLISHED");
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

  it("returns 404 for a version that doesn't exist", async () => {
    const { workflow } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/versions/99`,
    });

    expect(response.statusCode).toBe(404);
  });
});
