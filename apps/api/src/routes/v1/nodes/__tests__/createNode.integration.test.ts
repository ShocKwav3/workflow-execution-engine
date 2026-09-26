import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "@workflow-engine/core/test/fixtures.js";

describe("POST /workflows/{workflowId}/versions/{version}/nodes", () => {
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
    const { workflow, version } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/nodes`,
      payload: { name: "Reserve Inventory", type: "inventory" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Reserve Inventory", sequence: 0 });
    expect(response.headers["location"]).toBe(`/api/v1/nodes/${response.json().id}`);
  });

  it("returns config as submitted, and {} when omitted", async () => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, []);
    const url = `/api/v1/workflows/${workflow.id}/versions/${version.id}/nodes`;
    const config = { durationSeconds: 5, crash: { duringRetry: 0 } };

    const withConfig = await harness.app.inject({
      method: "POST",
      url,
      payload: { name: "Reserve Inventory", type: "inventory", config },
    });
    const withoutConfig = await harness.app.inject({
      method: "POST",
      url,
      payload: { name: "Charge Payment", type: "payment" },
    });

    expect(withConfig.statusCode).toBe(201);
    expect(withConfig.json().config).toEqual(config);
    expect(withoutConfig.json().config).toEqual({});
  });

  it.each([
    ["an unknown top-level key", { retries: 3 }],
    ["an unknown key inside crash", { crash: { publisherOutbox: 0 } }],
    ["a negative durationSeconds", { durationSeconds: -1 }],
  ])("rejects config with %s as VALIDATION_ERROR", async (_label, config) => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, []);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/nodes`,
      payload: { name: "Reserve Inventory", type: "inventory", config },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("refuses to add a node once the version is published, with VERSION_NOT_DRAFT", async () => {
    const { workflow, version } = await seedPublishedVersion(harness.db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/versions/${version.id}/nodes`,
      payload: { name: "Charge Payment", type: "payment" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_NOT_DRAFT");
  });
});
