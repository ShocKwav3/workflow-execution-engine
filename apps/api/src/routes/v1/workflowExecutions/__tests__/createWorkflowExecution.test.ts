import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedDraftVersion, seedPublishedVersion } from "@test/fixtures.js";

const DEFINITION = [
  { name: "Reserve Inventory", type: "inventory" },
  { name: "Charge Payment", type: "payment" },
];

describe("POST /workflows/{workflowId}/executions", () => {
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

  it("creates an execution against a published version", async () => {
    const { workflow, version } = await seedPublishedVersion(harness.db.pool, DEFINITION);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/executions`,
      payload: { workflowVersionId: version.id },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty("executionId");
  });

  it("refuses to execute a draft with VERSION_NOT_PUBLISHED", async () => {
    const { workflow, version } = await seedDraftVersion(harness.db.pool, DEFINITION);

    const response = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/executions`,
      payload: { workflowVersionId: version.id },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("VERSION_NOT_PUBLISHED");
  });

  it("returns the same execution for a repeated idempotency key", async () => {
    const { workflow, version } = await seedPublishedVersion(harness.db.pool, DEFINITION);
    const payload = { workflowVersionId: version.id };
    const headers = { "idempotency-key": "abc123" };

    const first = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/executions`,
      payload,
      headers,
    });
    const second = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/executions`,
      payload,
      headers,
    });

    expect(second.json().executionId).toBe(first.json().executionId);
  });
});
