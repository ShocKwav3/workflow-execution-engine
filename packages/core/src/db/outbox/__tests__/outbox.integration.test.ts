import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTransactionRunner, type TransactionRunner } from "@/db/transaction.js";
import type { AddOutboxMessageInput } from "@/db/outbox/outbox.schemas.js";
import { InternalValidationError } from "@/errors/index.js";
import type { OutboxMessageRow } from "@/db/outbox/outbox.types.js";
import { PgOutboxWriter } from "@/db/outbox/PgOutboxWriter.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";

describe("outbox persistence", () => {
  let db: TestDatabase;
  let unitOfWork: TransactionRunner<{ outbox: PgOutboxWriter }>;

  const addMessage = (input: AddOutboxMessageInput): Promise<void> =>
    unitOfWork.run(({ outbox }) => outbox.addOutboxMessage(input));

  const readMessages = async (): Promise<OutboxMessageRow[]> => {
    const result = await db.pool.query<OutboxMessageRow>("SELECT * FROM outbox_message");

    return result.rows;
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      outbox: new PgOutboxWriter(client),
    }));
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE outbox_message");
  });

  it("stores a message as PENDING with its destination, routing key, and payload", async () => {
    await addMessage({
      destination: "rabbitmq",
      routingKey: "workflow.execution.start",
      payload: { type: "SomeCommand", payload: { id: "abc" } },
    });

    const messages = await readMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      destination: "rabbitmq",
      routing_key: "workflow.execution.start",
      status: "PENDING",
      payload: { type: "SomeCommand", payload: { id: "abc" } },
      claimed_at: null,
      published_at: null,
    });
  });

  it("rejects an unsupported destination before reaching SQL", async () => {
    const add = addMessage({
      destination: "kafka",
      routingKey: "workflow.execution.start",
      payload: {},
    } as unknown as AddOutboxMessageInput);

    await expect(add).rejects.toBeInstanceOf(InternalValidationError);
    await expect(add).rejects.toHaveProperty("cause", expect.any(ZodError));
    await expect(readMessages()).resolves.toEqual([]);
  });

  it("rejects a blank routing key before reaching SQL", async () => {
    const add = addMessage({
      destination: "rabbitmq",
      routingKey: "   ",
      payload: {},
    });

    await expect(add).rejects.toBeInstanceOf(InternalValidationError);
    await expect(add).rejects.toHaveProperty("cause", expect.any(ZodError));
    await expect(readMessages()).resolves.toEqual([]);
  });

  it("keeps the underlying validation failure as the cause", async () => {
    const add = addMessage({
      destination: "rabbitmq",
      routingKey: "",
      payload: {},
    });

    await expect(add).rejects.toMatchObject({ cause: expect.any(ZodError) });
  });
});
