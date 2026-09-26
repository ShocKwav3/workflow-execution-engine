import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InternalValidationError } from "@/errors/index.js";
import { type TransactionRunner, createTransactionRunner } from "@/db/transaction.js";
import type { ClaimOutboxMessagesInput } from "@/db/outbox/outboxMessage.schemas.js";
import { PgOutboxWriter } from "@/db/outbox/PgOutboxWriter.js";
import { PgOutboxRelay } from "@/db/outbox/PgOutboxRelay.js";
import type { OutboxWriter } from "@/db/outbox/OutboxWriter.js";
import type { OutboxMessageRow } from "@/db/types.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";

const LONG_LEASE_MS = 60_000;

describe("outbox relay", () => {
  let db: TestDatabase;
  let unitOfWork: TransactionRunner<{ outboxMessages: OutboxWriter }>;
  let relay: PgOutboxRelay;

  const claim = (batchSize: number, leaseMs = LONG_LEASE_MS) =>
    relay.claimOutboxMessages({ destination: "bullmq", batchSize, leaseMs });

  async function seedMessages(count: number): Promise<OutboxMessageRow[]> {
    const rows: OutboxMessageRow[] = [];

    for (let i = 0; i < count; i++) {
      rows.push(
        await unitOfWork.run(({ outboxMessages }) =>
          outboxMessages.createOutboxMessage({
            destination: "bullmq",
            messageType: "StartWorkflowExecution",
            payload: { schemaVersion: 1, executionId: randomUUID() },
            correlationId: randomUUID(),
          }),
        ),
      );
    }

    return rows;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      outboxMessages: new PgOutboxWriter(client),
    }));
    relay = new PgOutboxRelay(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE outbox_message");
  });

  describe("claimOutboxMessages", () => {
    it("claims pending rows oldest first, each with its own token and a lease", async () => {
      const seeded = await seedMessages(3);

      const claimed = await claim(10);

      expect(claimed.map((row) => row.id)).toEqual(seeded.map((row) => row.id));

      for (const row of claimed) {
        expect(row).toMatchObject({ status: "PROCESSING", attempts: 1 });
        expect(row.claim_token).toEqual(expect.any(String));
        expect(row.lease_until!.getTime()).toBeGreaterThan(Date.now());
      }

      expect(new Set(claimed.map((row) => row.claim_token)).size).toBe(claimed.length);
    });

    it("never claims more rows than the batch size", async () => {
      await seedMessages(10);

      const claimed = await claim(2);
      const { rows } = await db.pool.query(
        "SELECT count(*)::int AS n FROM outbox_message WHERE status = 'PROCESSING'",
      );

      expect(claimed).toHaveLength(2);
      expect(rows[0].n).toBe(2);
    });

    it("skips rows under a live lease and rows already published", async () => {
      const [leased, published, pending] = await seedMessages(3);

      await claim(1);
      await db.pool.query("UPDATE outbox_message SET status = 'PUBLISHED' WHERE id = $1", [
        published!.id,
      ]);

      const claimed = await claim(10);

      expect(claimed.map((row) => row.id)).toEqual([pending!.id]);
      expect(claimed.map((row) => row.id)).not.toContain(leased!.id);
    });

    it("skips a row locked by another open transaction", async () => {
      const [locked, ...others] = await seedMessages(3);
      const client = await db.pool.connect();

      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM outbox_message WHERE id = $1 FOR UPDATE", [locked!.id]);

        const claimed = await claim(10);

        expect(claimed.map((row) => row.id)).toEqual(others.map((row) => row.id));
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    });

    it("gives concurrent claimers disjoint rows", async () => {
      const seeded = await seedMessages(6);

      const batches = await Promise.all([claim(2), claim(2), claim(2)]);
      const claimedIds = batches.flat().map((row) => row.id);

      expect(new Set(claimedIds).size).toBe(claimedIds.length);
      expect(claimedIds.toSorted()).toEqual(seeded.map((row) => row.id).toSorted());
    });

    it("re-claims a row whose lease expired, with a new token", async () => {
      const [seeded] = await seedMessages(1);
      const [first] = await claim(1, 1);

      await setTimeout(20);

      const [second] = await claim(1);

      expect(second).toMatchObject({ id: seeded!.id, status: "PROCESSING", attempts: 2 });
      expect(second!.claim_token).not.toBe(first!.claim_token);
    });

    it.each([
      ["a zero batch size", { batchSize: 0 }],
      ["a zero lease", { leaseMs: 0 }],
      ["a fractional lease", { leaseMs: 1.5 }],
      ["an unknown destination", { destination: "kafka" }],
    ])("rejects %s as an internal validation failure", async (_label, override) => {
      const claimWith = relay.claimOutboxMessages({
        destination: "bullmq",
        batchSize: 1,
        leaseMs: LONG_LEASE_MS,
        ...override,
      } as ClaimOutboxMessagesInput);

      await expect(claimWith).rejects.toBeInstanceOf(InternalValidationError);
      await expect(claimWith).rejects.toHaveProperty("cause", expect.any(ZodError));
    });
  });

  describe("markOutboxMessagePublished", () => {
    const markPublished = (row: OutboxMessageRow) =>
      relay.markOutboxMessagePublished({ id: row.id, claimToken: row.claim_token! });

    const readRow = async (id: string) =>
      (await db.pool.query<OutboxMessageRow>("SELECT * FROM outbox_message WHERE id = $1", [id]))
        .rows[0]!;

    it("fences out a stale owner whose lease was re-claimed", async () => {
      await seedMessages(1);
      const [ownerA] = await claim(1, 1);

      await setTimeout(20);

      const [ownerB] = await claim(1);

      expect(await markPublished(ownerA!)).toBe(false);
      expect(await readRow(ownerA!.id)).toMatchObject({
        status: "PROCESSING",
        claim_token: ownerB!.claim_token,
      });

      expect(await markPublished(ownerB!)).toBe(true);

      const published = await readRow(ownerB!.id);

      expect(published).toMatchObject({
        status: "PUBLISHED",
        claim_token: ownerB!.claim_token,
        lease_until: null,
      });
      expect(published.published_at).toBeInstanceOf(Date);
    });

    it("returns false when the row is already published", async () => {
      await seedMessages(1);
      const [claimed] = await claim(1);

      expect(await markPublished(claimed!)).toBe(true);
      expect(await markPublished(claimed!)).toBe(false);
    });

    it.each([
      ["a non-UUID id", { id: "row-1" }],
      ["a non-UUID claim token", { claimToken: "token-1" }],
    ])("rejects %s as an internal validation failure", async (_label, override) => {
      const markWith = relay.markOutboxMessagePublished({
        id: randomUUID(),
        claimToken: randomUUID(),
        ...override,
      });

      await expect(markWith).rejects.toBeInstanceOf(InternalValidationError);
      await expect(markWith).rejects.toHaveProperty("cause", expect.any(ZodError));
    });
  });
});
