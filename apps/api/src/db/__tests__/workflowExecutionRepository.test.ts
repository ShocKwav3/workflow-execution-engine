import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodeExecutionRepository } from "../nodeExecutionRepository.js";
import { ForeignKeyViolationError } from "../errors/index.js";
import { WorkflowExecutionRepository } from "../workflowExecutionRepository.js";
import { WorkflowRepository } from "../workflowRepository.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "./testDatabase.js";

async function createWorkflowWithVersion(
  workflowRepo: WorkflowRepository,
  definition: { name: string; type: string }[],
) {
  const workflow = await workflowRepo.createWorkflow({ name: "Order Fulfillment" });
  const { version, nodes } = await workflowRepo.createWorkflowVersion({
    workflowId: workflow.id,
    version: 1,
    definition,
  });

  return { workflow, version, nodes };
}

describe("WorkflowExecutionRepository", () => {
  let db: TestDatabase;
  let repo: WorkflowExecutionRepository;
  let nodeExecutionRepo: NodeExecutionRepository;
  let workflowRepo: WorkflowRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repo = new WorkflowExecutionRepository(db.pool);
    nodeExecutionRepo = new NodeExecutionRepository(db.pool);
    workflowRepo = new WorkflowRepository(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  it("creates an execution and snapshots one node_execution per node", async () => {
    const { workflow, version, nodes } = await createWorkflowWithVersion(workflowRepo, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const execution = await repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    expect(execution.status).toBe("PENDING");

    const nodeExecutions = await nodeExecutionRepo.getNodeExecutionsForWorkflowExecution(
      execution.id,
    );

    expect(nodeExecutions).toHaveLength(nodes.length);
    expect(nodeExecutions.map((ne) => ne.node_id).sort()).toEqual(nodes.map((n) => n.id).sort());
    expect(nodeExecutions.every((ne) => ne.status === "PENDING")).toBe(true);
  });

  it("returns the existing execution on a repeated idempotency key, without creating a duplicate", async () => {
    const { workflow, version } = await createWorkflowWithVersion(workflowRepo, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const first = await repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      idempotencyKey: "abc123",
    });
    const second = await repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      idempotencyKey: "abc123",
    });

    expect(second.id).toBe(first.id);

    const nodeExecutions = await nodeExecutionRepo.getNodeExecutionsForWorkflowExecution(first.id);

    expect(nodeExecutions).toHaveLength(2);
  });

  it("creates a separate execution each time when no idempotency key is given", async () => {
    const { workflow, version } = await createWorkflowWithVersion(workflowRepo, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const first = await repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });
    const second = await repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    expect(second.id).not.toBe(first.id);
  });

  it("rejects an execution whose version belongs to a different workflow", async () => {
    const { version } = await createWorkflowWithVersion(workflowRepo, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);
    const otherWorkflow = await workflowRepo.createWorkflow({ name: "Unrelated Workflow" });

    const createMismatched = repo.createWorkflowExecution({
      workflowId: otherWorkflow.id,
      workflowVersionId: version.id,
    });

    await expect(createMismatched).rejects.toThrow(ForeignKeyViolationError);
  });

  it("returns undefined when fetching an execution that doesn't exist", async () => {
    const fetched = await repo.getWorkflowExecutionById("00000000-0000-0000-0000-000000000000");

    expect(fetched).toBeUndefined();
  });

  it("rejects fetching an execution with a malformed id", async () => {
    const getMalformed = repo.getWorkflowExecutionById("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });
});
