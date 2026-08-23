import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../../test/routeHarness.js";

describe("workflow routes", () => {
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

  it("creates a workflow", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/workflows",
      payload: { name: "Order Fulfillment" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Order Fulfillment" });
  });

  it("rejects a workflow with a blank name as a problem document", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/v1/workflows",
      payload: { name: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      instance: "/api/v1/workflows",
    });
  });

  it("lists created workflows", async () => {
    await harness.app.inject({
      method: "POST",
      url: "/api/v1/workflows",
      payload: { name: "Workflow A" },
    });

    const response = await harness.app.inject({ method: "GET", url: "/api/v1/workflows" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });

  it("fetches a workflow by id", async () => {
    const created = await harness.app.inject({
      method: "POST",
      url: "/api/v1/workflows",
      payload: { name: "Order Fulfillment" },
    });
    const { id } = created.json();

    const response = await harness.app.inject({ method: "GET", url: `/api/v1/workflows/${id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(id);
  });

  it("returns a 404 problem document for an unknown workflow", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/api/v1/workflows/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
