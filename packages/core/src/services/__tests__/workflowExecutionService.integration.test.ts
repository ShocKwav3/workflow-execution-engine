import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTransactionRunner } from "@/db/transaction.js";
import { PgOutboxWriter } from "@/db/outbox/PgOutboxWriter.js";
import { PgWorkflowExecutionReader } from "@/db/workflowExecution/PgWorkflowExecutionReader.js";
import { PgWorkflowExecutionWriter } from "@/db/workflowExecution/PgWorkflowExecutionWriter.js";
import type { OutboxMessageRow } from "@/db/types.js";
import { WorkflowExecutionService } from "@/services/workflowExecutionService.js";
import { seedPublishedVersion, workflowExecutionUnitOfWorkFor } from "@core-test/fixtures.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";

const CORRELATION_ID = "3f6c1a2e-8b4d-4c1e-9a7f-2d5e6b8c9a01";

describe("WorkflowExecutionService", () => {
  let db: TestDatabase;
  let service: WorkflowExecutionService;

  const countRows = async (table: string): Promise<number> => {
    const result = await db.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table}`,
    );

    return result.rows[0]!.count;
  };

  const seedInput = async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve inventory", type: "inventory.reserve" },
      { name: "Charge payment", type: "payment.charge" },
    ]);

    return { workflowId: workflow.id, workflowVersionId: version.id };
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    service = new WorkflowExecutionService(
      new PgWorkflowExecutionReader(db.pool),
      workflowExecutionUnitOfWorkFor(db.pool),
    );
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow, outbox_message CASCADE");
  });

  it("writes exactly one pending outbox row carrying the job payload", async () => {
    const input = await seedInput();

    const execution = await service.createWorkflowExecution({
      ...input,
      correlationId: CORRELATION_ID,
    });
    const outbox = await db.pool.query<OutboxMessageRow>("SELECT * FROM outbox_message");

    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({
      destination: "bullmq",
      message_type: "StartWorkflowExecution",
      correlation_id: CORRELATION_ID,
      status: "PENDING",
      payload: { schemaVersion: 1, executionId: execution.id, correlationId: CORRELATION_ID },
    });
  });

  it("writes no second outbox row for an idempotent replay", async () => {
    const input = { ...(await seedInput()), idempotencyKey: "abc123" };

    const first = await service.createWorkflowExecution({
      ...input,
      correlationId: CORRELATION_ID,
    });
    const replay = await service.createWorkflowExecution({
      ...input,
      correlationId: "9d1e2f3a-4b5c-4d6e-8f7a-0b1c2d3e4f5a",
    });

    expect(replay.id).toBe(first.id);
    expect(await countRows("outbox_message")).toBe(1);
  });

  it("rolls back the execution and its outbox row together when the transaction fails", async () => {
    const input = await seedInput();
    const failingService = new WorkflowExecutionService(
      new PgWorkflowExecutionReader(db.pool),
      createTransactionRunner(db.pool, (client) => ({
        workflowExecutions: new PgWorkflowExecutionWriter(client),
        outboxMessages: {
          async createOutboxMessage(message) {
            await new PgOutboxWriter(client).createOutboxMessage(message);
            throw new Error("failure after the outbox insert");
          },
        },
      })),
    );

    await expect(
      failingService.createWorkflowExecution({ ...input, correlationId: CORRELATION_ID }),
    ).rejects.toThrow("failure after the outbox insert");

    expect(await countRows("workflow_execution")).toBe(0);
    expect(await countRows("node_execution")).toBe(0);
    expect(await countRows("outbox_message")).toBe(0);
  });
});
