import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import { startWorkflowExecutionJobContract } from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import { testRedisUrl } from "@workflow-engine/core/test/testRedis.js";
import { BullMqJobQueue, JOB_RETENTION } from "@/queue/BullMqJobQueue.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

function producerConnection(url: string): RedisConnection {
  return new RedisConnection(
    { url, enableOfflineQueue: false, commandTimeoutMs: 5_000 },
    silentLogger,
  );
}

describe("BullMqJobQueue", () => {
  let connection: RedisConnection;
  let jobQueue: BullMqJobQueue;
  let inspectorConnection: RedisConnection;
  let inspector: Queue;

  beforeEach(async () => {
    inspectorConnection = new RedisConnection({ url: testRedisUrl() }, silentLogger);
    await inspectorConnection.client.flushdb();
    inspector = new Queue(startWorkflowExecutionJobContract.queueName, {
      connection: inspectorConnection.client,
    });
    connection = producerConnection(testRedisUrl());
    jobQueue = new BullMqJobQueue(connection);
  });

  afterEach(async () => {
    await jobQueue.dispose();
    await connection.dispose();
    await inspector.close();
    await inspectorConnection.dispose();
  });

  it("becomes ready once its connection is", async () => {
    await vi.waitFor(() => expect(jobQueue.isReady()).toBe(true));
  });

  it("adds a job under the given id, name and data with the retention options", async () => {
    const jobId = randomUUID();
    const data = { schemaVersion: 1, executionId: jobId, correlationId: randomUUID() };

    await jobQueue.add({ name: "StartWorkflowExecution", data, jobId });

    const job = await inspector.getJob(jobId);

    expect(job).toBeDefined();
    expect(job?.name).toBe("StartWorkflowExecution");
    expect(job?.data).toEqual(data);
    expect(job?.opts).toMatchObject(JOB_RETENTION);
    expect(await job?.getState()).toBe("waiting");
  });

  it("ignores a second add with the same job id while the first is retained", async () => {
    const jobId = randomUUID();

    await jobQueue.add({ name: "StartWorkflowExecution", data: { attempt: 1 }, jobId });
    await jobQueue.add({ name: "StartWorkflowExecution", data: { attempt: 2 }, jobId });

    const counts = await inspector.getJobCounts("waiting");
    const job = await inspector.getJob(jobId);

    expect(counts.waiting).toBe(1);
    expect(job?.data).toEqual({ attempt: 1 });
  });

  it("is not ready while its connection cannot reach Redis", async () => {
    const unreachableConnection = producerConnection("redis://127.0.0.1:1");
    const unreachable = new BullMqJobQueue(unreachableConnection);

    try {
      expect(unreachable.isReady()).toBe(false);
    } finally {
      await unreachable.dispose();
      await unreachableConnection.dispose();
    }
  });
});
