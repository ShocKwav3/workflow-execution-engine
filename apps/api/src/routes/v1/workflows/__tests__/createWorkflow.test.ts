import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";

describe("POST /workflows", () => {
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
});
