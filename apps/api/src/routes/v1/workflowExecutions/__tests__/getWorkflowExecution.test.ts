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

describe("GET /workflows/{workflowId}/executions/{executionId}", () => {
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

  it("fetches an execution under its own workflow", async () => {
    const { workflow, version } = await seedPublishedVersion(harness.db.pool, DEFINITION);
    const created = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/executions`,
      payload: { workflowVersionId: version.id },
    });

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/executions/${created.json().executionId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("PENDING");
  });

  it("does not expose an execution under a workflow it doesn't belong to", async () => {
    const { workflow, version } = await seedPublishedVersion(harness.db.pool, DEFINITION);
    const other = await seedPublishedVersion(harness.db.pool, DEFINITION, "Unrelated Workflow");
    const created = await harness.app.inject({
      method: "POST",
      url: `/api/v1/workflows/${workflow.id}/executions`,
      payload: { workflowVersionId: version.id },
    });

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${other.workflow.id}/executions/${created.json().executionId}`,
    });

    expect(response.statusCode).toBe(404);
  });
});
