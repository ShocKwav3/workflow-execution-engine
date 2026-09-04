import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodeExecutionRepository } from "@/db/nodeExecutionRepository.js";
import { VersionNotPublishedError, WorkflowVersionMismatchError } from "@/errors/domain/index.js";
import { createTransactionRunner } from "@/db/transaction.js";
import type { CreateExecutionInput } from "@/db/workflowExecution.schemas.js";
import { PgWorkflowExecutionReader } from "@/db/workflowExecutionReader.js";
import { PgWorkflowExecutionWriter } from "@/db/workflowExecutionWriter.js";
import type { CreateWorkflowExecutionResult } from "@/db/workflowExecutionWriter.js";
import type { WorkflowExecutionUnitOfWork } from "@/db/workflowExecutionUnitOfWork.js";
import { WorkflowRepository } from "@/db/workflowRepository.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import { seedDraftVersion, seedPublishedVersion } from "@core-test/fixtures.js";

describe("workflow execution persistence", () => {
  let db: TestDatabase;
  let reader: PgWorkflowExecutionReader;
  let unitOfWork: WorkflowExecutionUnitOfWork;
  let nodeExecutionRepo: NodeExecutionRepository;
  let workflowRepo: WorkflowRepository;

  const createExecution = (input: CreateExecutionInput): Promise<CreateWorkflowExecutionResult> =>
    unitOfWork.run(({ workflowExecutions }) => workflowExecutions.createWorkflowExecution(input));

  beforeAll(async () => {
    db = await startTestDatabase();
    reader = new PgWorkflowExecutionReader(db.pool);
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      workflowExecutions: new PgWorkflowExecutionWriter(client),
    }));
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

    const { execution, created } = await createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    expect(created).toBe(true);
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

    const first = await createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      idempotencyKey: "abc123",
    });
    const second = await createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
      idempotencyKey: "abc123",
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.execution.id).toBe(first.execution.id);

    const nodeExecutions = await nodeExecutionRepo.getNodeExecutionsForWorkflowExecution({
      workflowId: workflow.id,
      workflowExecutionId: first.execution.id,
    });

    expect(nodeExecutions).toHaveLength(2);
  });

  it("creates a separate execution each time when no idempotency key is given", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const first = await createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });
    const second = await createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    expect(second.execution.id).not.toBe(first.execution.id);
    expect(second.created).toBe(true);
  });

  it("rejects an execution whose version belongs to a different workflow", async () => {
    const { version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);
    const otherWorkflow = await workflowRepo.createWorkflow({ name: "Unrelated Workflow" });

    const createMismatched = createExecution({
      workflowId: otherWorkflow.id,
      workflowVersionId: version.id,
    });

    await expect(createMismatched).rejects.toThrow(WorkflowVersionMismatchError);
  });

  it("refuses to execute a version that is still a draft", async () => {
    const { workflow, version } = await seedDraftVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const createOnDraft = createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    await expect(createOnDraft).rejects.toThrow(VersionNotPublishedError);
  });

  it("rolls back the execution and its node snapshots when the transaction fails", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);
    const failure = new Error("scope participant failed after the execution insert");

    const failedRun = unitOfWork.run(async ({ workflowExecutions }) => {
      await workflowExecutions.createWorkflowExecution({
        workflowId: workflow.id,
        workflowVersionId: version.id,
      });

      throw failure;
    });

    await expect(failedRun).rejects.toBe(failure);

    const executions = await db.pool.query("SELECT id FROM workflow_execution");
    const nodeExecutions = await db.pool.query("SELECT id FROM node_execution");

    expect(executions.rows).toHaveLength(0);
    expect(nodeExecutions.rows).toHaveLength(0);
  });

  it("returns undefined when fetching an execution that doesn't exist", async () => {
    const fetched = await reader.getWorkflowExecutionById("00000000-0000-0000-0000-000000000000");

    expect(fetched).toBeUndefined();
  });

  it("reads back an execution created inside a transaction", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const { execution } = await createExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    const fetched = await reader.getWorkflowExecutionById(execution.id);

    expect(fetched?.id).toBe(execution.id);
  });

  it("rejects fetching an execution with a malformed id", async () => {
    const getMalformed = reader.getWorkflowExecutionById("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });
});
