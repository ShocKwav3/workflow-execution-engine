import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type RouteHarness,
  resetRouteHarness,
  startRouteHarness,
  stopRouteHarness,
} from "../../../../../../test/routeHarness.js";
import { seedPublishedVersion } from "../../../../../../test/fixtures.js";

const DEFINITION = [
  { name: "Reserve Inventory", type: "inventory" },
  { name: "Charge Payment", type: "payment" },
];

describe("node execution routes", () => {
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

  it("lists one node execution per node of the published version", async () => {
    const { workflow, executionId } = await seedExecution();

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/executions/${executionId}/nodes`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(DEFINITION.length);
    expect(response.json().every((entry: { status: string }) => entry.status === "PENDING")).toBe(
      true,
    );
  });

  it("returns execution history with an empty attempt list before dispatch exists", async () => {
    const { workflow, executionId } = await seedExecution();

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/workflows/${workflow.id}/executions/${executionId}/history`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({ name: "Reserve Inventory", attempts: [] });
  });

  it("fetches a node execution under its own node", async () => {
    const { nodes, executionId } = await seedExecution();

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/nodes/${nodes[0]!.id}/executions/${executionId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nodeId: nodes[0]!.id, status: "PENDING" });
  });

  it("returns 404 for a node execution that doesn't exist", async () => {
    const { nodes } = await seedExecution();

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/nodes/${nodes[0]!.id}/executions/00000000-0000-0000-0000-000000000000`,
    });

    expect(response.statusCode).toBe(404);
  });
});
