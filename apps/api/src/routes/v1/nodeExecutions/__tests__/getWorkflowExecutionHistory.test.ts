import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "@test/routeHarness.js";
import { seedPublishedVersion } from "@test/fixtures.js";

const DEFINITION = [
  { name: "Reserve Inventory", type: "inventory" },
  { name: "Charge Payment", type: "payment" },
];

describe("GET /workflows/{workflowId}/executions/{executionId}/history", () => {
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

  async function seedExecution() {
    const seeded = await seedPublishedVersion(harness.db.pool, DEFINITION);
    const created = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${seeded.workflow.id}/executions`,
      payload: { workflowVersionId: seeded.version.id },
    });

    return { ...seeded, executionId: created.json().executionId as string };
  }

  it("returns execution history with an empty attempt list before dispatch exists", async () => {
    const { workflow, executionId } = await seedExecution();

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/executions/${executionId}/history`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({ name: "Reserve Inventory", attempts: [] });
  });
});
