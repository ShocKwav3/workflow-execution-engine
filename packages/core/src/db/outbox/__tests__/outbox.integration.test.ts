import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InternalValidationError } from "@/errors/index.js";
import { type TransactionRunner, createTransactionRunner } from "@/db/transaction.js";
import { PgOutboxWriter } from "@/db/outbox/PgOutboxWriter.js";
import type { OutboxWriter } from "@/db/outbox/OutboxWriter.js";
import type { CreateOutboxMessageInput } from "@/db/outbox/outboxMessage.schemas.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";

const validInput: CreateOutboxMessageInput = {
  destination: "bullmq",
  messageType: "StartWorkflowExecution",
  payload: { schemaVersion: 1, executionId: "0b8e6f2a-4c3d-4e5f-8a9b-1c2d3e4f5a6b" },
  correlationId: "3f6c1a2e-8b4d-4c1e-9a7f-2d5e6b8c9a01",
};

describe("outbox persistence", () => {
  let db: TestDatabase;
  let unitOfWork: TransactionRunner<{ outboxMessages: OutboxWriter }>;

  const createOutboxMessage = (input: CreateOutboxMessageInput) =>
    unitOfWork.run(({ outboxMessages }) => outboxMessages.createOutboxMessage(input));

  beforeAll(async () => {
    db = await startTestDatabase();
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      outboxMessages: new PgOutboxWriter(client),
    }));
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE outbox_message");
  });

  it("writes a pending, unclaimed row exactly as given", async () => {
    const created = await createOutboxMessage(validInput);

    expect(created).toMatchObject({
      destination: "bullmq",
      message_type: "StartWorkflowExecution",
      payload: validInput.payload,
      correlation_id: validInput.correlationId,
      status: "PENDING",
      claim_token: null,
      lease_until: null,
      attempts: 0,
      published_at: null,
    });
    expect(created.created_at).toBeInstanceOf(Date);
  });

  it.each([
    ["an unknown destination", { destination: "kafka" }],
    ["an empty message type", { messageType: "" }],
    ["a non-UUID correlation id", { correlationId: "req-1" }],
    ["an array payload", { payload: [1, 2] }],
  ])("rejects %s as an internal validation failure", async (_label, override) => {
    const create = createOutboxMessage({ ...validInput, ...override } as CreateOutboxMessageInput);

    await expect(create).rejects.toBeInstanceOf(InternalValidationError);
    await expect(create).rejects.toHaveProperty("cause", expect.any(ZodError));
  });
});
