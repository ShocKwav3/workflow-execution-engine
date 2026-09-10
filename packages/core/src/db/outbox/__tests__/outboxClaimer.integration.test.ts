import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InternalValidationError } from "@/errors/index.js";
import {
  OUTBOX_MESSAGE_STATUS,
  OUTBOX_MESSAGE_STATUSES,
  type OutboxMessageRow,
} from "@/db/outbox/outbox.types.js";
import { PgOutboxClaimer } from "@/db/outbox/PgOutboxClaimer.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";

describe("outbox claiming", () => {
  let db: TestDatabase;
  let claimer: PgOutboxClaimer;

  const claim = (overrides: { batchSize?: number; staleClaimSeconds?: number } = {}) =>
    claimer.claimOutboxMessages({
      destination: "rabbitmq",
      staleClaimSeconds: 60,
      batchSize: 10,
      ...overrides,
    });

  const insertMessage = async (
    values: {
      destination?: string;
      routingKey?: string;
      status?: string;
      claimedAt?: string | null;
      createdAt?: string;
    } = {},
  ): Promise<OutboxMessageRow> => {
    const {
      destination = "rabbitmq",
      routingKey = "workflow.execution.start",
      status = OUTBOX_MESSAGE_STATUS.PENDING,
      claimedAt = null,
      createdAt = "now()",
    } = values;

    const result = await db.pool.query<OutboxMessageRow>(
      `INSERT INTO outbox_message (destination, routing_key, payload, status, claimed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, ${createdAt})
       RETURNING *`,
      [destination, routingKey, { type: "SomeCommand" }, status, claimedAt],
    );

    return result.rows[0];
  };

  const readMessage = async (id: string): Promise<OutboxMessageRow> => {
    const result = await db.pool.query<OutboxMessageRow>(
      "SELECT * FROM outbox_message WHERE id = $1",
      [id],
    );

    return result.rows[0];
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    claimer = new PgOutboxClaimer(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE outbox_message");
  });

  it("claims a pending message, moving it to PROCESSING with a claim timestamp", async () => {
    const message = await insertMessage();

    const claimed = await claim();

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      id: message.id,
      status: OUTBOX_MESSAGE_STATUS.PROCESSING,
    });
    expect(claimed[0]?.claimed_at).toBeInstanceOf(Date);
  });

  it("returns the oldest messages first, up to the batch size", async () => {
    const oldest = await insertMessage({ createdAt: "now() - interval '3 minutes'" });
    const middle = await insertMessage({ createdAt: "now() - interval '2 minutes'" });

    await insertMessage({ createdAt: "now() - interval '1 minute'" });

    const claimed = await claim({ batchSize: 2 });

    expect(claimed.map((message) => message.id)).toEqual([oldest.id, middle.id]);
  });

  it("ignores messages for another destination", async () => {
    await insertMessage({ destination: "kafka" });

    await expect(claim()).resolves.toEqual([]);
  });

  it("ignores messages already published", async () => {
    await insertMessage({ status: OUTBOX_MESSAGE_STATUS.PUBLISHED });

    await expect(claim()).resolves.toEqual([]);
  });

  it("leaves a fresh claim held by another publisher alone", async () => {
    await insertMessage({
      status: OUTBOX_MESSAGE_STATUS.PROCESSING,
      claimedAt: new Date().toISOString(),
    });

    await expect(claim()).resolves.toEqual([]);
  });

  it("reclaims a message whose claim went stale", async () => {
    const message = await insertMessage({
      status: OUTBOX_MESSAGE_STATUS.PROCESSING,
      claimedAt: new Date(Date.now() - 120_000).toISOString(),
    });

    const claimed = await claim({ staleClaimSeconds: 60 });

    expect(claimed.map((entry) => entry.id)).toEqual([message.id]);
  });

  it("never hands the same message to two concurrent publishers", async () => {
    await Promise.all(Array.from({ length: 6 }, () => insertMessage()));

    const [first, second] = await Promise.all([claim(), claim()]);
    const claimedIds = [...first, ...second].map((message) => message.id);

    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(claimedIds).toHaveLength(6);
  });

  it("marks a message published with a publication timestamp", async () => {
    const message = await insertMessage();

    await claim();

    await expect(claimer.markOutboxMessagePublished(message.id)).resolves.toBe(true);

    const stored = await readMessage(message.id);

    expect(stored.status).toBe(OUTBOX_MESSAGE_STATUS.PUBLISHED);
    expect(stored.published_at).toBeInstanceOf(Date);
  });

  it("reports no transition when the message was never claimed", async () => {
    const message = await insertMessage();

    await expect(claimer.markOutboxMessagePublished(message.id)).resolves.toBe(false);

    const stored = await readMessage(message.id);

    expect(stored.status).toBe(OUTBOX_MESSAGE_STATUS.PENDING);
    expect(stored.published_at).toBeNull();
  });

  it("reports no transition when the message no longer exists", async () => {
    await expect(claimer.markOutboxMessagePublished(randomUUID())).resolves.toBe(false);
  });

  it("rejects an unsupported destination before reaching SQL", async () => {
    const claimed = claimer.claimOutboxMessages({
      destination: "kafka",
      staleClaimSeconds: 60,
      batchSize: 10,
    } as unknown as Parameters<PgOutboxClaimer["claimOutboxMessages"]>[0]);

    await expect(claimed).rejects.toBeInstanceOf(InternalValidationError);
    await expect(claimed).rejects.toHaveProperty("cause", expect.any(ZodError));
  });

  it("rejects a non-positive batch size before reaching SQL", async () => {
    const claimed = claim({ batchSize: 0 });

    await expect(claimed).rejects.toBeInstanceOf(InternalValidationError);
    await expect(claimed).rejects.toHaveProperty("cause", expect.any(ZodError));
  });

  it("rejects a malformed message id before reaching SQL", async () => {
    const marked = claimer.markOutboxMessagePublished("not-a-uuid");

    await expect(marked).rejects.toBeInstanceOf(InternalValidationError);
    await expect(marked).rejects.toHaveProperty("cause", expect.any(ZodError));
  });

  it("agrees with the status values the database will actually accept", async () => {
    const inserts = OUTBOX_MESSAGE_STATUSES.map((status) => insertMessage({ status }));

    await expect(Promise.all(inserts)).resolves.toHaveLength(OUTBOX_MESSAGE_STATUSES.length);
  });
});
