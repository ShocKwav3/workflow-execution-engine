import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalValidationError } from "@/errors/index.js";
import { UniqueConstraintViolationError } from "@/db/errors/index.js";
import type { NodeExecutionUnitOfWork } from "@/db/nodeExecution/NodeExecutionUnitOfWork.js";
import { PgNodeExecutionReader } from "@/db/nodeExecution/PgNodeExecutionReader.js";
import { PgNodeExecutionWriter } from "@/db/nodeExecution/PgNodeExecutionWriter.js";
import {
  NODE_EXECUTION_ATTEMPT_STATUS,
  NODE_EXECUTION_STATUS,
} from "@/schemas/nodeExecution.schemas.js";
import type { WorkflowExecutionUnitOfWork } from "@/db/workflowExecution/WorkflowExecutionUnitOfWork.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import {
  type NodeDefinition,
  nodeExecutionUnitOfWorkFor,
  seedPublishedVersion,
  workflowExecutionUnitOfWorkFor,
} from "@core-test/fixtures.js";

describe("node execution persistence", () => {
  let db: TestDatabase;
  let reader: PgNodeExecutionReader;
  let unitOfWork: WorkflowExecutionUnitOfWork;
  let nodeExecutionUnitOfWork: NodeExecutionUnitOfWork;

  beforeAll(async () => {
    db = await startTestDatabase();
    reader = new PgNodeExecutionReader(db.pool);
    unitOfWork = workflowExecutionUnitOfWorkFor(db.pool);
    nodeExecutionUnitOfWork = nodeExecutionUnitOfWorkFor(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function createExecutionWithNodes(definition: NodeDefinition[]) {
    const { workflow, version, nodes } = await seedPublishedVersion(db.pool, definition);
    const { execution } = await unitOfWork.run(({ workflowExecutions }) =>
      workflowExecutions.createWorkflowExecution({
        workflowId: workflow.id,
        workflowVersionId: version.id,
      }),
    );

    return { workflow, execution, nodes };
  }

  it("returns the node_execution snapshot in creation order", async () => {
    const { workflow, execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const nodeExecutions = await reader.getNodeExecutionsForWorkflowExecution({
      workflowId: workflow.id,
      workflowExecutionId: execution.id,
    });

    expect(nodeExecutions.map((ne) => ne.node_id)).toEqual(nodes.map((n) => n.id));
  });

  it("returns an empty array for an execution that doesn't exist", async () => {
    const nodeExecutions = await reader.getNodeExecutionsForWorkflowExecution({
      workflowId: "00000000-0000-0000-0000-000000000000",
      workflowExecutionId: "00000000-0000-0000-0000-000000000000",
    });

    expect(nodeExecutions).toEqual([]);
  });

  it("rejects fetching node executions with a malformed workflowExecutionId", async () => {
    const getMalformed = reader.getNodeExecutionsForWorkflowExecution({
      workflowId: "not-a-uuid",
      workflowExecutionId: "not-a-uuid",
    });

    await expect(getMalformed).rejects.toBeInstanceOf(InternalValidationError);
    await expect(getMalformed).rejects.toHaveProperty("cause", expect.any(ZodError));
  });

  it("returns execution history with nodes and empty attempts, since nothing has executed yet", async () => {
    const { workflow, execution, nodes } = await createExecutionWithNodes([
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    const history = await reader.getWorkflowExecutionHistory({
      workflowId: workflow.id,
      workflowExecutionId: execution.id,
    });

    expect(history).toHaveLength(nodes.length);
    expect(history.every((entry) => entry.attempts.length === 0)).toBe(true);
    expect(history.map((entry) => entry.node.name)).toEqual(nodes.map((n) => n.name));
  });

  it("rejects fetching history with a malformed workflowExecutionId", async () => {
    const getMalformed = reader.getWorkflowExecutionHistory({
      workflowId: "not-a-uuid",
      workflowExecutionId: "not-a-uuid",
    });

    await expect(getMalformed).rejects.toBeInstanceOf(InternalValidationError);
    await expect(getMalformed).rejects.toHaveProperty("cause", expect.any(ZodError));
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

    const nodeExecutions = await reader.getNodeExecutionsForWorkflowExecution({
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

    const entry = await reader.getNodeExecutionByNodeAndExecution({
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

    const entry = await reader.getNodeExecutionByNodeAndExecution({
      nodeId: "00000000-0000-0000-0000-000000000000",
      workflowExecutionId: execution.id,
    });

    expect(entry).toBeUndefined();
  });

  describe("executor steps and writes", () => {
    async function seedSteps(
      definition: NodeDefinition[] = [{ name: "Reserve", type: "inventory" }],
    ) {
      const { execution } = await createExecutionWithNodes(definition);

      return { execution, steps: await reader.getNodeExecutionSteps(execution.id) };
    }

    async function attemptsOf(nodeExecutionId: string) {
      const { rows } = await db.pool.query(
        `SELECT attempt_number, status, started_at, finished_at, error
         FROM node_execution_attempt WHERE node_execution_id = $1 ORDER BY attempt_number`,
        [nodeExecutionId],
      );

      return rows;
    }

    async function nodeExecutionStatus(nodeExecutionId: string) {
      const { rows } = await db.pool.query<{ status: string }>(
        "SELECT status FROM node_execution WHERE id = $1",
        [nodeExecutionId],
      );

      return rows[0]?.status;
    }

    it("returns steps in sequence order with each node's config", async () => {
      const { steps } = await seedSteps([
        { name: "Reserve", type: "inventory", config: { durationSeconds: 2 } },
        { name: "Charge", type: "payment", config: { crash: { duringRetry: 0 } } },
      ]);

      expect(steps.map((step) => [step.name, step.sequence, step.config])).toEqual([
        ["Reserve", 0, { durationSeconds: 2 }],
        ["Charge", 1, { crash: { duringRetry: 0 } }],
      ]);
      expect(steps.every((step) => step.status === NODE_EXECUTION_STATUS.PENDING)).toBe(true);
    });

    it("returns no steps for an execution that doesn't exist", async () => {
      expect(await reader.getNodeExecutionSteps("00000000-0000-0000-0000-000000000000")).toEqual(
        [],
      );
    });

    it("numbers attempts 1, 2, 3 and starts each RUNNING", async () => {
      const { steps } = await seedSteps();
      const id = steps[0]!.id;

      for (let i = 0; i < 3; i++) {
        await nodeExecutionUnitOfWork.run(({ nodeExecutions }) => nodeExecutions.createAttempt(id));
      }

      const attempts = await attemptsOf(id);

      expect(attempts.map((a) => a.attempt_number)).toEqual([1, 2, 3]);
      expect(attempts.every((a) => a.status === NODE_EXECUTION_ATTEMPT_STATUS.RUNNING)).toBe(true);
      expect(attempts.every((a) => a.started_at instanceof Date)).toBe(true);
    });

    it("abandons only RUNNING attempts, recording when and why", async () => {
      const { steps } = await seedSteps();
      const id = steps[0]!.id;

      const first = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.createAttempt(id),
      );

      await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.completeAttempt(first.id),
      );
      await nodeExecutionUnitOfWork.run(({ nodeExecutions }) => nodeExecutions.createAttempt(id));

      const abandoned = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.abandonRunningAttempts(id),
      );
      const attempts = await attemptsOf(id);

      expect(abandoned).toBe(1);
      expect(attempts.map((a) => a.status)).toEqual([
        NODE_EXECUTION_ATTEMPT_STATUS.COMPLETED,
        NODE_EXECUTION_ATTEMPT_STATUS.ABANDONED,
      ]);
      expect(attempts[1].finished_at).toBeInstanceOf(Date);
      expect(attempts[1].error).toBe("worker lost before the attempt finished");
    });

    it("abandons nothing when no attempt is RUNNING", async () => {
      const { steps } = await seedSteps();

      const abandoned = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.abandonRunningAttempts(steps[0]!.id),
      );

      expect(abandoned).toBe(0);
    });

    it("completes a RUNNING attempt once and refuses a second time", async () => {
      const { steps } = await seedSteps();
      const attempt = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.createAttempt(steps[0]!.id),
      );
      const complete = () =>
        nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
          nodeExecutions.completeAttempt(attempt.id),
        );

      expect(await complete()).toBe(true);
      expect(await complete()).toBe(false);

      const [stored] = await attemptsOf(steps[0]!.id);

      expect(stored.status).toBe(NODE_EXECUTION_ATTEMPT_STATUS.COMPLETED);
      expect(stored.finished_at).toBeInstanceOf(Date);
    });

    it("refuses to complete an ABANDONED attempt", async () => {
      const { steps } = await seedSteps();
      const attempt = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.createAttempt(steps[0]!.id),
      );

      await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.abandonRunningAttempts(steps[0]!.id),
      );

      const completed = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.completeAttempt(attempt.id),
      );

      expect(completed).toBe(false);
      expect((await attemptsOf(steps[0]!.id))[0].status).toBe(
        NODE_EXECUTION_ATTEMPT_STATUS.ABANDONED,
      );
    });

    it("moves a node execution PENDING → RUNNING → COMPLETED, matching RUNNING again on resume", async () => {
      const { steps } = await seedSteps();
      const id = steps[0]!.id;
      const markRunning = () =>
        nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
          nodeExecutions.markNodeExecutionRunning(id),
        );
      const markCompleted = () =>
        nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
          nodeExecutions.markNodeExecutionCompleted(id),
        );

      expect(await markRunning()).toBe(true);
      expect(await markRunning()).toBe(true);
      expect(await markCompleted()).toBe(true);
      expect(await nodeExecutionStatus(id)).toBe(NODE_EXECUTION_STATUS.COMPLETED);
    });

    it("refuses to complete a PENDING node execution or reopen a COMPLETED one", async () => {
      const { steps } = await seedSteps();
      const id = steps[0]!.id;

      const completedWhilePending = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.markNodeExecutionCompleted(id),
      );

      expect(completedWhilePending).toBe(false);

      await nodeExecutionUnitOfWork.run(async ({ nodeExecutions }) => {
        await nodeExecutions.markNodeExecutionRunning(id);
        await nodeExecutions.markNodeExecutionCompleted(id);
      });

      const reopened = await nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
        nodeExecutions.markNodeExecutionRunning(id),
      );

      expect(reopened).toBe(false);
      expect(await nodeExecutionStatus(id)).toBe(NODE_EXECUTION_STATUS.COMPLETED);
    });

    it("rejects the second of two concurrent attempts that computed the same number", async () => {
      const { steps } = await seedSteps();
      const id = steps[0]!.id;
      const first = await db.pool.connect();
      const second = await db.pool.connect();

      try {
        await first.query("BEGIN");
        await second.query("BEGIN");
        await new PgNodeExecutionWriter(first).createAttempt(id);

        // Blocks on the unique index until the first transaction ends.
        const blocked = new PgNodeExecutionWriter(second)
          .createAttempt(id)
          .catch((error: unknown) => error);

        await vi.waitFor(async () => {
          const { rows } = await db.pool.query<{ waiting: number }>(
            "SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted",
          );

          expect(rows[0]!.waiting).toBeGreaterThan(0);
        });

        await first.query("COMMIT");

        expect(await blocked).toBeInstanceOf(UniqueConstraintViolationError);
      } finally {
        await second.query("ROLLBACK");
        await first.query("ROLLBACK");
        first.release();
        second.release();
      }

      expect((await attemptsOf(id)).map((a) => a.attempt_number)).toEqual([1]);
    });

    it("rejects malformed ids", async () => {
      await expect(reader.getNodeExecutionSteps("not-a-uuid")).rejects.toBeInstanceOf(
        InternalValidationError,
      );
      await expect(
        nodeExecutionUnitOfWork.run(({ nodeExecutions }) =>
          nodeExecutions.createAttempt("not-a-uuid"),
        ),
      ).rejects.toBeInstanceOf(InternalValidationError);
    });
  });
});
