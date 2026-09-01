import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodeExecutionRepository } from "@/db/nodeExecutionRepository.js";
import { WorkflowExecutionRepository } from "@/db/workflowExecutionRepository.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import { seedPublishedVersion } from "@core-test/fixtures.js";

describe("NodeExecutionRepository", () => {
  let db: TestDatabase;
  let repo: NodeExecutionRepository;
  let executionRepo: WorkflowExecutionRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repo = new NodeExecutionRepository(db.pool);
    executionRepo = new WorkflowExecutionRepository(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function createExecutionWithNodes(definition: { name: string; type: string }[]) {
    const { workflow, version, nodes } = await seedPublishedVersion(db.pool, definition);
    const execution = await executionRepo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    return { workflow, execution, nodes };
  }

  it("returns the node_execution snapshot in creation order", async () => {
    const { workflow, execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const nodeExecutions = await repo.getNodeExecutionsForWorkflowExecution({
      workflowId: workflow.id,
      workflowExecutionId: execution.id,
    });

    expect(nodeExecutions.map((ne) => ne.node_id)).toEqual(nodes.map((n) => n.id));
  });

  it("returns an empty array for an execution that doesn't exist", async () => {
    const nodeExecutions = await repo.getNodeExecutionsForWorkflowExecution({
      workflowId: "00000000-0000-0000-0000-000000000000",
      workflowExecutionId: "00000000-0000-0000-0000-000000000000",
    });

    expect(nodeExecutions).toEqual([]);
  });

  it("rejects fetching node executions with a malformed workflowExecutionId", async () => {
    const getMalformed = repo.getNodeExecutionsForWorkflowExecution({
      workflowId: "not-a-uuid",
      workflowExecutionId: "not-a-uuid",
    });

    await expect(getMalformed).rejects.toThrow(ZodError);
  });

  it("returns execution history with nodes and empty attempts, since nothing has executed yet", async () => {
    const { workflow, execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const history = await repo.getWorkflowExecutionHistory({
      workflowId: workflow.id,
      workflowExecutionId: execution.id,
    });

    expect(history).toHaveLength(nodes.length);
    expect(history.every((entry) => entry.attempts.length === 0)).toBe(true);
    expect(history.map((entry) => entry.node.name)).toEqual(nodes.map((n) => n.name));
  });

  it("rejects fetching history with a malformed workflowExecutionId", async () => {
    const getMalformed = repo.getWorkflowExecutionHistory({
      workflowId: "not-a-uuid",
      workflowExecutionId: "not-a-uuid",
    });

    await expect(getMalformed).rejects.toThrow(ZodError);
  });

  it("does not return node executions under a workflow they don't belong to", async () => {
    const { execution } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
    ]);
    const other = await seedPublishedVersion(
      db.pool,
      [{ name: "Unrelated", type: "inventory" }],
      "Unrelated Workflow",
    );

    const nodeExecutions = await repo.getNodeExecutionsForWorkflowExecution({
      workflowId: other.workflow.id,
      workflowExecutionId: execution.id,
    });

    expect(nodeExecutions).toEqual([]);
  });

  it("fetches a single node's execution within a specific workflow execution", async () => {
    const { execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const entry = await repo.getNodeExecutionByNodeAndExecution({
      nodeId: nodes[0]!.id,
      workflowExecutionId: execution.id,
    });

    expect(entry?.node.node_id).toBe(nodes[0]!.id);
    expect(entry?.node.name).toBe("Reserve Inventory");
    expect(entry?.attempts).toEqual([]);
  });

  it("returns undefined for a node/execution pair that doesn't exist", async () => {
    const { execution } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const entry = await repo.getNodeExecutionByNodeAndExecution({
      nodeId: "00000000-0000-0000-0000-000000000000",
      workflowExecutionId: execution.id,
    });

    expect(entry).toBeUndefined();
  });
});
