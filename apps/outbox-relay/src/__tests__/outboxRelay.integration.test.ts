import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type TransactionRunner,
  createTransactionRunner,
} from "@workflow-engine/core/db/transaction.js";
import type { OutboxWriter } from "@workflow-engine/core/db/outbox/OutboxWriter.js";
import { PgOutboxClaimer } from "@workflow-engine/core/db/outbox/PgOutboxClaimer.js";
import { PgOutboxWriter } from "@workflow-engine/core/db/outbox/PgOutboxWriter.js";
import type { OutboxMessageRow } from "@workflow-engine/core/db/types.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import {
  START_WORKFLOW_EXECUTION,
  WORKFLOW_EXECUTIONS_QUEUE,
} from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "@workflow-engine/core/test/testDatabase.js";
import { testRedisUrl } from "@workflow-engine/core/test/testRedis.js";
import type { OutboxRelayConfig } from "@/config.js";
import { OutboxRelay } from "@/OutboxRelay.js";
import { BullMqJobQueue } from "@/queue/BullMqJobQueue.js";
import type { AddJobInput, JobQueue } from "@/queue/JobQueue.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

const BATCH_SIZE = 3;

const config: OutboxRelayConfig = {
  pollIntervalMs: 1_000,
  batchSize: BATCH_SIZE,
  leaseMs: 30_000,
  publishTimeoutMs: 5_000,
  maxBackoffMs: 30_000,
};

function producerConnection(url: string): RedisConnection {
  return new RedisConnection(
    { url, enableOfflineQueue: false, commandTimeoutMs: config.publishTimeoutMs },
    silentLogger,
  );
}

describe("OutboxRelay", () => {
  let db: TestDatabase;
  let unitOfWork: TransactionRunner<{ outboxMessages: OutboxWriter }>;
  let claimer: PgOutboxClaimer;
  let connection: RedisConnection;
  let jobQueue: BullMqJobQueue;
  let inspectorConnection: RedisConnection;
  let inspector: Queue;

  async function seedMessage(payload: Record<string, unknown>): Promise<OutboxMessageRow> {
    return unitOfWork.run(({ outboxMessages }) =>
      outboxMessages.createOutboxMessage({
        destination: "bullmq",
        messageType: START_WORKFLOW_EXECUTION,
        payload,
        correlationId: randomUUID(),
      }),
    );
  }

  function validPayload(executionId = randomUUID()): Record<string, unknown> {
    return { schemaVersion: 1, executionId, correlationId: randomUUID() };
  }

  async function outboxRow(id: string): Promise<OutboxMessageRow> {
    const { rows } = await db.pool.query<OutboxMessageRow>(
      "SELECT * FROM outbox_message WHERE id = $1",
      [id],
    );

    return rows[0]!;
  }

  function relayWith(queue: JobQueue, overrides: Partial<OutboxRelayConfig> = {}) {
    return new OutboxRelay(claimer, queue, { ...config, ...overrides }, silentLogger);
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      outboxMessages: new PgOutboxWriter(client),
    }));
    claimer = new PgOutboxClaimer(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE outbox_message");
    inspectorConnection = new RedisConnection({ url: testRedisUrl() }, silentLogger);
    await inspectorConnection.client.flushdb();
    inspector = new Queue(WORKFLOW_EXECUTIONS_QUEUE, { connection: inspectorConnection.client });
    connection = producerConnection(testRedisUrl());
    jobQueue = new BullMqJobQueue(connection);
    await vi.waitFor(() => expect(jobQueue.isReady()).toBe(true));
  });

  afterEach(async () => {
    await jobQueue.dispose();
    await connection.dispose();
    await inspector.close();
    await inspectorConnection.dispose();
  });

  it("publishes a pending row as a job keyed by execution id and marks it PUBLISHED", async () => {
    const payload = validPayload();
    const seeded = await seedMessage(payload);

    await relayWith(jobQueue).relayBatch();

    const job = await inspector.getJob(payload.executionId as string);
    const row = await outboxRow(seeded.id);

    expect(job?.name).toBe(START_WORKFLOW_EXECUTION);
    expect(job?.data).toEqual(payload);
    expect(row).toMatchObject({ status: "PUBLISHED", attempts: 1, lease_until: null });
  });

  it("reports a full batch so the poller runs again, and a partial one so it waits", async () => {
    for (let i = 0; i < BATCH_SIZE + 1; i++) {
      await seedMessage(validPayload());
    }

    const relay = relayWith(jobQueue);

    expect(await relay.relayBatch()).toBe(true);
    expect(await relay.relayBatch()).toBe(false);
    expect((await inspector.getJobCounts("waiting")).waiting).toBe(BATCH_SIZE + 1);
  });

  it("absorbs a second message for the same execution into the retained job", async () => {
    const payload = validPayload();
    const first = await seedMessage(payload);
    const second = await seedMessage(payload);

    await relayWith(jobQueue).relayBatch();

    expect((await inspector.getJobCounts("waiting")).waiting).toBe(1);
    expect(await outboxRow(first.id)).toMatchObject({ status: "PUBLISHED" });
    expect(await outboxRow(second.id)).toMatchObject({ status: "PUBLISHED" });
  });

  it("leaves a row with an invalid payload PROCESSING and publishes nothing", async () => {
    const seeded = await seedMessage({ schemaVersion: 99 });

    await relayWith(jobQueue).relayBatch();

    expect(await outboxRow(seeded.id)).toMatchObject({ status: "PROCESSING", attempts: 1 });
    expect((await inspector.getJobCounts("waiting")).waiting).toBe(0);
  });

  it("leaves the row PROCESSING when the queue rejects the job", async () => {
    const seeded = await seedMessage(validPayload());
    const failingQueue: JobQueue = {
      isReady: () => true,
      add: async () => {
        throw new Error("Command timed out");
      },
    };

    await relayWith(failingQueue).relayBatch();

    expect(await outboxRow(seeded.id)).toMatchObject({ status: "PROCESSING", attempts: 1 });
  });

  it("claims nothing while the queue is not ready", async () => {
    const seeded = await seedMessage(validPayload());
    const unreachableConnection = producerConnection("redis://127.0.0.1:1");
    const unreachableQueue = new BullMqJobQueue(unreachableConnection);

    try {
      expect(await relayWith(unreachableQueue).relayBatch()).toBe(false);
      expect(await outboxRow(seeded.id)).toMatchObject({ status: "PENDING", attempts: 0 });
    } finally {
      await unreachableQueue.dispose();
      await unreachableConnection.dispose();
    }
  });

  it("does not throw when its claim was taken over before the settle", async () => {
    const seeded = await seedMessage(validPayload());
    const leaseMs = 1;
    // Wraps the real queue: once the lease has lapsed, a second claimer takes the row over.
    const overtakenQueue: JobQueue = {
      isReady: () => jobQueue.isReady(),
      add: async (input: AddJobInput) => {
        await jobQueue.add(input);
        await sleep(5);
        await claimer.claimOutboxMessages({ destination: "bullmq", batchSize: 1, leaseMs: 60_000 });
      },
    };

    await expect(relayWith(overtakenQueue, { leaseMs }).relayBatch()).resolves.toBe(false);

    expect(await outboxRow(seeded.id)).toMatchObject({ status: "PROCESSING", attempts: 2 });
  });
});
