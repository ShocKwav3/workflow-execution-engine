import type { Pool } from "pg";
import { parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import {
  type ClaimOutboxMessagesInput,
  claimOutboxMessagesInputSchema,
} from "./outboxMessage.schemas.js";
import type { OutboxRelay } from "./OutboxRelay.js";
import type { OutboxMessageRow } from "../types.js";

// MATERIALIZED: as an IN-subquery the planner may re-run the locking SELECT per row and claim past LIMIT.
const CLAIM_SQL = `
  WITH claimable AS MATERIALIZED (
    SELECT id FROM outbox_message
    WHERE destination = $1
      AND status IN ('PENDING', 'PROCESSING') -- literals, not $n: must match the partial index predicate
      AND (status = 'PENDING' OR lease_until < now())
    ORDER BY created_at
    LIMIT $2
    FOR NO KEY UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE outbox_message o
    SET status = 'PROCESSING',
        claim_token = gen_random_uuid(),
        lease_until = now() + $3::int * interval '1 millisecond',
        attempts = o.attempts + 1
    FROM claimable c
    WHERE o.id = c.id
    RETURNING o.*
  )
  SELECT * FROM claimed ORDER BY created_at`;

export class PgOutboxRelay implements OutboxRelay {
  constructor(private readonly pool: Pool) {}

  async claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<OutboxMessageRow[]> {
    const { destination, batchSize, leaseMs } = parseInternal(
      claimOutboxMessagesInputSchema,
      input,
      "PgOutboxRelay.claimOutboxMessages",
    );

    try {
      const result = await this.pool.query<OutboxMessageRow>(CLAIM_SQL, [
        destination,
        batchSize,
        leaseMs,
      ]);

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
