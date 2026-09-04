import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { createTransactionRunner } from "@/db/transaction.js";

class FakeClient {
  readonly queries: string[] = [];
  readonly releaseArgs: unknown[] = [];

  constructor(private readonly failingStatement?: { sql: string; error: Error }) {}

  async query(sql: string): Promise<{ rows: [] }> {
    this.queries.push(sql);

    if (this.failingStatement?.sql === sql) {
      throw this.failingStatement.error;
    }

    return { rows: [] };
  }

  release(err?: Error | boolean): void {
    this.releaseArgs.push(err);
  }
}

function fakePool(client: FakeClient): Pool {
  return { connect: async () => client as unknown as PoolClient } as unknown as Pool;
}

describe("createTransactionRunner", () => {
  it("commits and releases the client when the callback succeeds", async () => {
    const client = new FakeClient();
    const manager = createTransactionRunner(fakePool(client), () => ({ marker: "scope" }));

    const result = await manager.run(async (scope) => `${scope.marker}-done`);

    expect(result).toBe("scope-done");
    expect(client.queries).toEqual(["BEGIN", "COMMIT"]);
    expect(client.releaseArgs).toEqual([undefined]);
  });

  it("rolls back and rethrows the original error when the callback fails", async () => {
    const client = new FakeClient();
    const manager = createTransactionRunner(fakePool(client), () => ({}));
    const failure = new Error("callback failed");

    const run = manager.run(async () => {
      throw failure;
    });

    await expect(run).rejects.toBe(failure);
    expect(client.queries).toEqual(["BEGIN", "ROLLBACK"]);
    expect(client.releaseArgs).toEqual([undefined]);
  });

  it("rolls back when the scope factory itself throws", async () => {
    const client = new FakeClient();
    const failure = new Error("scope factory failed");
    const manager = createTransactionRunner(fakePool(client), () => {
      throw failure;
    });

    const run = manager.run(async () => "unreachable");

    await expect(run).rejects.toBe(failure);
    expect(client.queries).toEqual(["BEGIN", "ROLLBACK"]);
    expect(client.releaseArgs).toEqual([undefined]);
  });

  it("preserves both errors and discards the client when the rollback fails", async () => {
    const rollbackFailure = new Error("rollback failed");
    const client = new FakeClient({ sql: "ROLLBACK", error: rollbackFailure });
    const manager = createTransactionRunner(fakePool(client), () => ({}));
    const originalFailure = new Error("callback failed");

    const run = manager.run(async () => {
      throw originalFailure;
    });

    await expect(run).rejects.toThrow(AggregateError);
    await run.catch((error: AggregateError) => {
      expect(error.errors).toEqual([originalFailure, rollbackFailure]);
    });
    expect(client.releaseArgs).toEqual([rollbackFailure]);
  });

  it("hands the scope factory the exact client the work runs on", async () => {
    const client = new FakeClient();
    const seen: PoolClient[] = [];
    const manager = createTransactionRunner(fakePool(client), (scopeClient) => {
      seen.push(scopeClient);

      return { client: scopeClient };
    });

    const scopeClient = await manager.run(async (scope) => scope.client);

    expect(seen).toEqual([client]);
    expect(scopeClient).toBe(client);
  });
});
