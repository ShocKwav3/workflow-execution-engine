import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";

describe("POST /workflows/{workflowId}/versions", () => {
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
});
