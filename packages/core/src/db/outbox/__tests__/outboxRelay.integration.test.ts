import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type TransactionRunner, createTransactionRunner } from "@/db/transaction.js";
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
  });
});
