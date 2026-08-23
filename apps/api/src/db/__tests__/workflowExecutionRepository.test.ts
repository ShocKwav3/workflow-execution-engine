import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodeExecutionRepository } from "../nodeExecutionRepository.js";
import {
  VersionNotPublishedError,
  WorkflowVersionMismatchError,
} from "../../errors/domain/index.js";
import { WorkflowExecutionRepository } from "../workflowExecutionRepository.js";
import { WorkflowRepository } from "../workflowRepository.js";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../../../test/testDatabase.js";
import { seedDraftVersion, seedPublishedVersion } from "../../../test/fixtures.js";

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
    const { workflow, version, nodes } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const execution = await repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    expect(execution.status).toBe("PENDING");

    const nodeExecutions = await nodeExecutionRepo.getNodeExecutionsForWorkflowExecution({
      workflowId: workflow.id,
      workflowExecutionId: execution.id,
    });

    expect(nodeExecutions).toHaveLength(nodes.length);
    expect(nodeExecutions.map((ne) => ne.node_id).sort()).toEqual(nodes.map((n) => n.id).sort());
    expect(nodeExecutions.every((ne) => ne.status === "PENDING")).toBe(true);
  });

  it("returns the existing execution on a repeated idempotency key, without creating a duplicate", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
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

    const nodeExecutions = await nodeExecutionRepo.getNodeExecutionsForWorkflowExecution({
      workflowId: workflow.id,
      workflowExecutionId: first.id,
    });

    expect(nodeExecutions).toHaveLength(2);
  });

  it("creates a separate execution each time when no idempotency key is given", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
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
    const { version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);
    const otherWorkflow = await workflowRepo.createWorkflow({ name: "Unrelated Workflow" });

    const createMismatched = repo.createWorkflowExecution({
      workflowId: otherWorkflow.id,
      workflowVersionId: version.id,
    });

    await expect(createMismatched).rejects.toThrow(WorkflowVersionMismatchError);
  });

  it("refuses to execute a version that is still a draft", async () => {
    const { workflow, version } = await seedDraftVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const createOnDraft = repo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    await expect(createOnDraft).rejects.toThrow(VersionNotPublishedError);
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
