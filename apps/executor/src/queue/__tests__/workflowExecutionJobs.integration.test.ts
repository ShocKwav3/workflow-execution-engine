import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgNodeExecutionReader } from "@workflow-engine/core/db/nodeExecution/PgNodeExecutionReader.js";
import { PgWorkflowExecutionStatusWriter } from "@workflow-engine/core/db/workflowExecution/PgWorkflowExecutionStatusWriter.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import {
  type StartWorkflowExecutionJob,
  startWorkflowExecutionJobContract,
} from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import {
  nodeExecutionUnitOfWorkFor,
  seedPublishedVersion,
  workflowExecutionUnitOfWorkFor,
} from "@workflow-engine/core/test/fixtures.js";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "@workflow-engine/core/test/testDatabase.js";
import { testRedisUrl } from "@workflow-engine/core/test/testRedis.js";
import { BullMqConsumer } from "@/queue/BullMqConsumer.js";
import { WorkflowExecutionJobHandler } from "@/queue/WorkflowExecutionJobHandler.js";
import type { NodeWork } from "@/run/NodeWork.js";
import { type RunOutcome, WorkflowExecutionRunner } from "@/run/WorkflowExecutionRunner.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

const instantNodeWork: NodeWork = { perform: async () => {} };

// The same job options the outbox relay adds with.
const RELAY_JOB_OPTIONS = { removeOnComplete: { age: 86_400, count: 1_000 }, removeOnFail: false };

describe("workflow execution jobs through BullMqConsumer", () => {
  let db: TestDatabase;
  let workerConnection: RedisConnection;
  let producerConnection: RedisConnection;
  let queue: Queue;
  let runner: WorkflowExecutionRunner;
  let consumer: BullMqConsumer<StartWorkflowExecutionJob, RunOutcome>;

  beforeAll(async () => {
    db = await startTestDatabase();
    workerConnection = new RedisConnection(
      { url: testRedisUrl(), maxRetriesPerRequest: null },
      silentLogger,
    );
    producerConnection = new RedisConnection({ url: testRedisUrl() }, silentLogger);
    queue = new Queue(startWorkflowExecutionJobContract.queueName, {
      connection: producerConnection.client,
    });
    await queue.obliterate({ force: true });

    runner = new WorkflowExecutionRunner(
      new PgWorkflowExecutionStatusWriter(db.pool),
      nodeExecutionUnitOfWorkFor(db.pool),
      new PgNodeExecutionReader(db.pool),
      instantNodeWork,
      silentLogger,
    );
    consumer = new BullMqConsumer(
      workerConnection,
      new WorkflowExecutionJobHandler(runner, silentLogger),
      { concurrency: 1 },
      silentLogger,
    );
    consumer.start();
  }, 60_000);

  afterAll(async () => {
    await consumer.dispose();
    await queue.obliterate({ force: true });
    await queue.close();
    await producerConnection.dispose();
    await workerConnection.dispose();
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
    vi.restoreAllMocks();
  });

  async function createExecution() {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve", type: "inventory" },
      { name: "Charge", type: "payment" },
    ]);
    const { execution } = await workflowExecutionUnitOfWorkFor(db.pool).run(
      ({ workflowExecutions }) =>
        workflowExecutions.createWorkflowExecution({
          workflowId: workflow.id,
          workflowVersionId: version.id,
        }),
    );

    return execution.id;
  }

  function addStartJob(executionId: string) {
    return queue.add(
      startWorkflowExecutionJobContract.jobName,
      { schemaVersion: 1, executionId, correlationId: randomUUID() },
      { ...RELAY_JOB_OPTIONS, jobId: executionId },
    );
  }

  async function waitForState(jobId: string, state: "completed" | "failed") {
    await vi.waitFor(async () => expect(await queue.getJobState(jobId)).toBe(state), {
      timeout: 10_000,
    });

    return (await queue.getJob(jobId))!;
  }

  async function executionStatus(executionId: string) {
    const { rows } = await db.pool.query<{ status: string }>(
      "SELECT status FROM workflow_execution WHERE id = $1",
      [executionId],
    );

    return rows[0]?.status;
  }

  it("consumes a job added the way the relay adds it and completes the execution", async () => {
    const executionId = await createExecution();

    await addStartJob(executionId);
    const job = await waitForState(executionId, "completed");

    expect(job.returnvalue).toBe("completed");
    expect(await executionStatus(executionId)).toBe("COMPLETED");
  });

  it("skips a re-added job for an execution that already completed", async () => {
    const executionId = await createExecution();

    await addStartJob(executionId);
    const first = await waitForState(executionId, "completed");

    await first.remove();

    await addStartJob(executionId);
    const second = await waitForState(executionId, "completed");

    expect(second.returnvalue).toBe("skipped");
    expect(await executionStatus(executionId)).toBe("COMPLETED");
  });

  it("fails malformed job data immediately, without retrying or running anything", async () => {
    const run = vi.spyOn(runner, "run");
    const jobId = randomUUID();

    await queue.add(
      startWorkflowExecutionJobContract.jobName,
      { schemaVersion: 1, executionId: "not-a-uuid" },
      { ...RELAY_JOB_OPTIONS, jobId, attempts: 3 },
    );
    const job = await waitForState(jobId, "failed");

    expect(job.attemptsMade).toBe(1);
    expect(job.failedReason).toBe(`invalid ${startWorkflowExecutionJobContract.jobName} job data`);
    expect(run).not.toHaveBeenCalled();
  });

  it("fails a job with an unsupported name immediately", async () => {
    const run = vi.spyOn(runner, "run");
    const jobId = randomUUID();

    await queue.add("SomethingElse", {}, { ...RELAY_JOB_OPTIONS, jobId, attempts: 3 });
    const job = await waitForState(jobId, "failed");

    expect(job.attemptsMade).toBe(1);
    expect(job.failedReason).toBe("unsupported job name: SomethingElse");
    expect(run).not.toHaveBeenCalled();
  });
});
