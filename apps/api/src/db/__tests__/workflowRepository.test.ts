import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WorkflowRepository } from "../workflowRepository.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "./testDatabase.js";

let db: TestDatabase;
let repo: WorkflowRepository;

beforeAll(async () => {
  db = await startTestDatabase();
  repo = new WorkflowRepository(db.pool);
}, 60_000);

afterAll(async () => {
  await stopTestDatabase(db);
});

beforeEach(async () => {
  await db.pool.query("TRUNCATE workflow CASCADE");
});

describe("WorkflowRepository", () => {
  it("creates and fetches a workflow", async () => {
    const created = await repo.createWorkflow({ name: "Order Fulfillment" });

    const fetched = await repo.getWorkflowById(created.id);

    expect(fetched).toEqual(created);
    expect(created.name).toBe("Order Fulfillment");
  });

  it("rejects creating a workflow with an empty name", async () => {
    const createEmpty = repo.createWorkflow({ name: "  " });

    await expect(createEmpty).rejects.toThrow();
  });

  it("returns undefined when fetching a workflow that doesn't exist", async () => {
    const fetched = await repo.getWorkflowById("00000000-0000-0000-0000-000000000000");

    expect(fetched).toBeUndefined();
  });

  it("rejects fetching a workflow with a malformed id instead of leaking a raw DB error", async () => {
    const getMalformed = repo.getWorkflowById("not-a-uuid");

    await expect(getMalformed).rejects.toThrow();
  });

  it("lists all created workflows", async () => {
    await repo.createWorkflow({ name: "Workflow A" });
    await repo.createWorkflow({ name: "Workflow B" });

    const workflows = await repo.listWorkflows();

    expect(workflows).toHaveLength(2);
    expect(workflows.map((w) => w.name)).toEqual(["Workflow A", "Workflow B"]);
  });

  it("creates and fetches a workflow version, round-tripping the definition", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });
    const definition = [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ];

    const created = await repo.createWorkflowVersion({
      workflowId: workflow.id,
      version: 1,
      definition,
    });
    const fetched = await repo.getWorkflowVersion({ workflowId: workflow.id, version: 1 });

    expect(created.definition).toEqual(definition);
    expect(fetched).toEqual(created);
  });

  it("rejects creating a workflow version with an invalid workflowId", async () => {
    const createInvalid = repo.createWorkflowVersion({
      workflowId: "not-a-uuid",
      version: 1,
      definition: [],
    });

    await expect(createInvalid).rejects.toThrow();
  });

  it("rejects creating a workflow version with a non-positive version number", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const createInvalid = repo.createWorkflowVersion({
      workflowId: workflow.id,
      version: 0,
      definition: [],
    });

    await expect(createInvalid).rejects.toThrow();
  });

  it("returns undefined when fetching a workflow version that doesn't exist", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const fetched = await repo.getWorkflowVersion({ workflowId: workflow.id, version: 99 });

    expect(fetched).toBeUndefined();
  });

  it("rejects fetching a workflow version with a non-positive version number", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const getInvalid = repo.getWorkflowVersion({ workflowId: workflow.id, version: -1 });

    await expect(getInvalid).rejects.toThrow();
  });

  it("rejects a duplicate version number for the same workflow", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    await repo.createWorkflowVersion({ workflowId: workflow.id, version: 1, definition: [] });

    const createDuplicate = repo.createWorkflowVersion({
      workflowId: workflow.id,
      version: 1,
      definition: [],
    });

    await expect(createDuplicate).rejects.toThrow();
  });
});
