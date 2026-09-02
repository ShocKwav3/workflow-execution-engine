import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";

describe("GET /workflows", () => {
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
});
