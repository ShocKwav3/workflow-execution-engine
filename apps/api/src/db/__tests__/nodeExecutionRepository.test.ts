import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodeExecutionRepository } from "../nodeExecutionRepository.js";
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

describe("NodeExecutionRepository", () => {
  let db: TestDatabase;
  let repo: NodeExecutionRepository;
  let executionRepo: WorkflowExecutionRepository;
  let workflowRepo: WorkflowRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repo = new NodeExecutionRepository(db.pool);
    executionRepo = new WorkflowExecutionRepository(db.pool);
    workflowRepo = new WorkflowRepository(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function createExecutionWithNodes(definition: { name: string; type: string }[]) {
    const { workflow, version, nodes } = await createWorkflowWithVersion(workflowRepo, definition);
    const execution = await executionRepo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    return { execution, nodes };
  }

  it("returns the node_execution snapshot in creation order", async () => {
    const { execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const nodeExecutions = await repo.getNodeExecutionsForWorkflowExecution(execution.id);

    expect(nodeExecutions.map((ne) => ne.node_id)).toEqual(nodes.map((n) => n.id));
  });

  it("returns an empty array for an execution with no nodes", async () => {
    const { workflow, version } = await createWorkflowWithVersion(workflowRepo, []);
    const execution = await executionRepo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    const nodeExecutions = await repo.getNodeExecutionsForWorkflowExecution(execution.id);

    expect(nodeExecutions).toEqual([]);
  });

  it("rejects fetching node executions with a malformed workflowExecutionId", async () => {
    const getMalformed = repo.getNodeExecutionsForWorkflowExecution("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });

  it("returns execution history with nodes and empty attempts, since nothing has executed yet", async () => {
    const { execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const history = await repo.getWorkflowExecutionHistory(execution.id);

    expect(history).toHaveLength(nodes.length);
    expect(history.every((entry) => entry.attempts.length === 0)).toBe(true);
    expect(history.map((entry) => entry.node.name)).toEqual(nodes.map((n) => n.name));
  });

  it("rejects fetching history with a malformed workflowExecutionId", async () => {
    const getMalformed = repo.getWorkflowExecutionHistory("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
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
    const { execution } = await createExecutionWithNodes([]);

    const entry = await repo.getNodeExecutionByNodeAndExecution({
      nodeId: "00000000-0000-0000-0000-000000000000",
      workflowExecutionId: execution.id,
    });

    expect(entry).toBeUndefined();
  });
});
