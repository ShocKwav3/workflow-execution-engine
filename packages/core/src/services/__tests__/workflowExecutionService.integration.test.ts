import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startWorkflowExecutionMessageSchema } from "@/amqp/messages/startWorkflowExecution.js";
import { AMQP_TOPOLOGY } from "@/amqp/topology.js";
import type { OutboxMessageRow } from "@/db/outbox/outbox.types.js";
import { PgWorkflowExecutionReader } from "@/db/workflowExecution/PgWorkflowExecutionReader.js";
import { WorkflowExecutionService } from "@/services/workflowExecutionService.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import { seedPublishedVersion, workflowExecutionUnitOfWorkFor } from "@core-test/fixtures.js";

describe("workflow execution service", () => {
  let db: TestDatabase;
  let service: WorkflowExecutionService;

  const readOutboxMessages = async (): Promise<OutboxMessageRow[]> => {
    const result = await db.pool.query<OutboxMessageRow>("SELECT * FROM outbox_message");

    return result.rows;
  };

  const countRows = async (table: string): Promise<number> => {
    const result = await db.pool.query<{ count: string }>(`SELECT count(*) FROM ${table}`);

    return Number(result.rows[0]!.count);
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
    await db.pool.query("TRUNCATE workflow CASCADE");
    await db.pool.query("TRUNCATE outbox_message");
  });

  it("writes one PENDING command addressed by the declared topology", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
    ]);

    const execution = await service.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    const messages = await readOutboxMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      status: "PENDING",
      destination: "rabbitmq",
      routing_key: AMQP_TOPOLOGY.routingKey,
      published_at: null,
    });

    const command = startWorkflowExecutionMessageSchema.parse(messages[0]!.payload);

    expect(command.type).toBe("StartWorkflowExecution");
    expect(command.payload.workflowExecutionId).toBe(execution.id);
  });

  it("writes no second command when an idempotency key replays", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Charge Payment", type: "payment" },
    ]);

    const input = {
      workflowId: workflow.id,
      workflowVersionId: version.id,
      idempotencyKey: "order-4711",
    };

    const first = await service.createWorkflowExecution(input);
    const second = await service.createWorkflowExecution(input);

    expect(second.id).toBe(first.id);

    const messages = await readOutboxMessages();

    expect(messages).toHaveLength(1);

    const command = startWorkflowExecutionMessageSchema.parse(messages[0]!.payload);

    expect(command.payload.workflowExecutionId).toBe(first.id);
  });

  it("rolls back the execution and its node snapshots when the outbox write fails", async () => {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve Inventory", type: "inventory" },
      { name: "Charge Payment", type: "payment" },
    ]);

    await db.pool.query("ALTER TABLE outbox_message ADD CONSTRAINT outbox_no_writes CHECK (false)");

    try {
      const create = service.createWorkflowExecution({
        workflowId: workflow.id,
        workflowVersionId: version.id,
      });

      await expect(create).rejects.toThrow();

      expect(await countRows("workflow_execution")).toBe(0);
      expect(await countRows("node_execution")).toBe(0);
      expect(await countRows("outbox_message")).toBe(0);
    } finally {
      await db.pool.query("ALTER TABLE outbox_message DROP CONSTRAINT outbox_no_writes");
    }
  });
});
