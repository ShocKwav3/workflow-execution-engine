import type { Pool, PoolClient } from "pg";

export type TransactionWork<TScope, T> = (scope: TScope) => Promise<T>;

export interface TransactionRunner<TScope> {
  run<T>(work: TransactionWork<TScope, T>): Promise<T>;
}

export type TransactionScopeFactory<TScope> = (client: PoolClient) => TScope;

export function createTransactionRunner<TScope>(
  pool: Pool,
  createScope: TransactionScopeFactory<TScope>,
): TransactionRunner<TScope> {
  return {
    async run<T>(work: TransactionWork<TScope, T>): Promise<T> {
      const client = await pool.connect();
      let rollbackFailure: unknown;

      try {
        await client.query("BEGIN");

        try {
          const result = await work(createScope(client));

          await client.query("COMMIT");

          return result;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            rollbackFailure = rollbackError;

            throw new AggregateError([error, rollbackError], "transaction rollback failed", {
              cause: rollbackError,
            });
          }

          throw error;
        }
      } finally {
        // A client whose ROLLBACK failed may still hold an open transaction — destroy it, don't reuse it.
        if (rollbackFailure) {
          client.release(rollbackFailure instanceof Error ? rollbackFailure : true);
        } else {
          client.release();
        }
      }
    },
  };
}
