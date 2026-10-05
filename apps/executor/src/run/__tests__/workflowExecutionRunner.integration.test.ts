import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PgNodeExecutionReader } from "@workflow-engine/core/db/nodeExecution/PgNodeExecutionReader.js";
import { PgWorkflowExecutionStatusWriter } from "@workflow-engine/core/db/workflowExecution/PgWorkflowExecutionStatusWriter.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import {
  type NodeDefinition,
  nodeExecutionUnitOfWorkFor,
  seedPublishedVersion,
  workflowExecutionUnitOfWorkFor,
} from "@workflow-engine/core/test/fixtures.js";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "@workflow-engine/core/test/testDatabase.js";
import { ExecutionStateConflictError } from "@/run/ExecutionStateConflictError.js";
import type { NodeWork, NodeWorkInput } from "@/run/NodeWork.js";
import { WorkflowExecutionRunner } from "@/run/WorkflowExecutionRunner.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

const TWO_NODES: NodeDefinition[] = [
  { name: "Reserve", type: "inventory" },
  { name: "Charge", type: "payment" },
];

class RecordingNodeWork implements NodeWork {
  readonly calls: Pick<NodeWorkInput, "config" | "attemptNumber">[] = [];

  constructor(
    private readonly onPerform: (input: NodeWorkInput) => Promise<void> = async () => {},
  ) {}

  async perform(input: NodeWorkInput): Promise<void> {
    this.calls.push({ config: input.config, attemptNumber: input.attemptNumber });
    await this.onPerform(input);
  }
}

interface AttemptState {
  node: string;
  attempt_number: number;
  status: string;
}

describe("WorkflowExecutionRunner", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  function runnerWith(nodeWork: NodeWork) {
    return new WorkflowExecutionRunner(
      new PgWorkflowExecutionStatusWriter(db.pool),
      nodeExecutionUnitOfWorkFor(db.pool),
      new PgNodeExecutionReader(db.pool),
      nodeWork,
      silentLogger,
    );
  }

  async function createExecution(definition: NodeDefinition[] = TWO_NODES) {
    const { workflow, version } = await seedPublishedVersion(db.pool, definition);
    const { execution } = await workflowExecutionUnitOfWorkFor(db.pool).run(
      ({ workflowExecutions }) =>
        workflowExecutions.createWorkflowExecution({
          workflowId: workflow.id,
          workflowVersionId: version.id,
        }),
    );

    return execution.id;
  }

  async function executionState(executionId: string) {
    const { rows } = await db.pool.query<{
      status: string;
      completed_at: Date | null;
      updated_at: Date;
    }>("SELECT status, completed_at, updated_at FROM workflow_execution WHERE id = $1", [
      executionId,
    ]);

    return rows[0]!;
  }

  async function nodeStates(executionId: string) {
    const { rows } = await db.pool.query<{ id: string; node: string; status: string }>(
      `SELECT ne.id, n.name AS node, ne.status
       FROM node_execution ne JOIN node n ON n.id = ne.node_id
       WHERE ne.workflow_execution_id = $1 ORDER BY n.sequence`,
      [executionId],
    );

    return rows;
  }

  async function attemptStates(executionId: string) {
    const { rows } = await db.pool.query<AttemptState>(
      `SELECT n.name AS node, nea.attempt_number, nea.status
       FROM node_execution_attempt nea
       JOIN node_execution ne ON ne.id = nea.node_execution_id
       JOIN node n ON n.id = ne.node_id
       WHERE ne.workflow_execution_id = $1
       ORDER BY n.sequence, nea.attempt_number`,
      [executionId],
    );

    return rows;
  }

  it("runs every node once on a fresh execution and completes it", async () => {
    const executionId = await createExecution([
      { name: "Reserve", type: "inventory", config: { durationSeconds: 1 } },
      { name: "Charge", type: "payment" },
    ]);
    const work = new RecordingNodeWork();

    const outcome = await runnerWith(work).run({ executionId });

    expect(outcome).toBe("completed");
    expect(work.calls).toEqual([
      { config: { durationSeconds: 1 }, attemptNumber: 1 },
      { config: {}, attemptNumber: 1 },
    ]);
    expect((await nodeStates(executionId)).map((n) => n.status)).toEqual([
      "COMPLETED",
      "COMPLETED",
    ]);
    expect(await attemptStates(executionId)).toEqual([
      { node: "Reserve", attempt_number: 1, status: "COMPLETED" },
      { node: "Charge", attempt_number: 1, status: "COMPLETED" },
    ]);

    const execution = await executionState(executionId);

    expect(execution.status).toBe("COMPLETED");
    expect(execution.completed_at).toBeInstanceOf(Date);
  });

  it("resumes after a lost worker: skips the completed node and abandons the interrupted attempt", async () => {
    const executionId = await createExecution();
    const [reserve, charge] = await nodeStates(executionId);
    const nodeExecutions = nodeExecutionUnitOfWorkFor(db.pool);

    // The state a worker leaves behind when it dies during node 2.
    await new PgWorkflowExecutionStatusWriter(db.pool).markWorkflowExecutionRunning(executionId);
    await nodeExecutions.run(async ({ nodeExecutions }) => {
      const attempt = await nodeExecutions.createAttempt(reserve!.id);

      await nodeExecutions.markNodeExecutionRunning(reserve!.id);
      await nodeExecutions.completeAttempt(attempt.id);
      await nodeExecutions.markNodeExecutionCompleted(reserve!.id);
      await nodeExecutions.createAttempt(charge!.id);
      await nodeExecutions.markNodeExecutionRunning(charge!.id);
    });
    const work = new RecordingNodeWork();

    const outcome = await runnerWith(work).run({ executionId });

    expect(outcome).toBe("completed");
    expect(work.calls).toEqual([{ config: {}, attemptNumber: 2 }]);
    expect(await attemptStates(executionId)).toEqual([
      { node: "Reserve", attempt_number: 1, status: "COMPLETED" },
      { node: "Charge", attempt_number: 1, status: "ABANDONED" },
      { node: "Charge", attempt_number: 2, status: "COMPLETED" },
    ]);
    expect((await executionState(executionId)).status).toBe("COMPLETED");
  });

  it("leaves a resumable state when the node work throws", async () => {
    const executionId = await createExecution();
    let calls = 0;
    const failing = new RecordingNodeWork(async () => {
      if (++calls === 2) {
        throw new Error("worker died");
      }
    });

    await expect(runnerWith(failing).run({ executionId })).rejects.toThrow("worker died");
    expect((await nodeStates(executionId)).map((n) => n.status)).toEqual(["COMPLETED", "RUNNING"]);
    expect((await executionState(executionId)).status).toBe("RUNNING");

    const retry = new RecordingNodeWork();

    expect(await runnerWith(retry).run({ executionId })).toBe("completed");
    expect(retry.calls).toEqual([{ config: {}, attemptNumber: 2 }]);
    expect(await attemptStates(executionId)).toEqual([
      { node: "Reserve", attempt_number: 1, status: "COMPLETED" },
      { node: "Charge", attempt_number: 1, status: "ABANDONED" },
      { node: "Charge", attempt_number: 2, status: "COMPLETED" },
    ]);
  });

  it("skips an execution that is already COMPLETED without writing anything", async () => {
    const executionId = await createExecution();

    await runnerWith(new RecordingNodeWork()).run({ executionId });
    const before = await executionState(executionId);
    const attemptsBefore = await attemptStates(executionId);
    const work = new RecordingNodeWork();

    const outcome = await runnerWith(work).run({ executionId });

    expect(outcome).toBe("skipped");
    expect(work.calls).toEqual([]);
    expect(await executionState(executionId)).toEqual(before);
    expect(await attemptStates(executionId)).toEqual(attemptsBefore);
  });

  it("skips an execution that doesn't exist", async () => {
    const work = new RecordingNodeWork();

    const outcome = await runnerWith(work).run({
      executionId: "00000000-0000-0000-0000-000000000000",
    });

    expect(outcome).toBe("skipped");
    expect(work.calls).toEqual([]);
  });

  it("refuses to complete an attempt another worker abandoned mid-work", async () => {
    const executionId = await createExecution([{ name: "Reserve", type: "inventory" }]);
    // Simulates a second worker resuming while this one is still inside the node's work.
    const superseded = new RecordingNodeWork(async () => {
      await db.pool.query(
        `UPDATE node_execution_attempt SET status = 'ABANDONED', finished_at = now()
         WHERE node_execution_id IN (SELECT id FROM node_execution WHERE workflow_execution_id = $1)`,
        [executionId],
      );
    });

    await expect(runnerWith(superseded).run({ executionId })).rejects.toBeInstanceOf(
      ExecutionStateConflictError,
    );
    expect((await nodeStates(executionId)).map((n) => n.status)).toEqual(["RUNNING"]);
    expect((await executionState(executionId)).status).toBe("RUNNING");
  });
});
