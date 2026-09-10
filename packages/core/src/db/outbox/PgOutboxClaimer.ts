import type { Pool } from "pg";
import { parseInternal } from "@/errors/index.js";
import { classifyPgError } from "../errors/index.js";
import {
  type ClaimOutboxMessagesInput,
  claimOutboxMessagesInputSchema,
  outboxMessageIdSchema,
} from "./outbox.schemas.js";
import type { OutboxClaimer } from "./OutboxClaimer.js";
import { OUTBOX_MESSAGE_STATUS, type OutboxMessageRow } from "./outbox.types.js";

export class PgOutboxClaimer implements OutboxClaimer {
  constructor(private readonly pool: Pool) {}

  async claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<OutboxMessageRow[]> {
    const { destination, staleClaimSeconds, batchSize } = parseInternal(
      claimOutboxMessagesInputSchema,
      input,
      "PgOutboxClaimer.claimOutboxMessages",
    );

    try {
      const result = await this.pool.query<OutboxMessageRow>(
        // RETURNING emits rows unordered, so the outer SELECT is what makes the batch oldest-first.
        `WITH claimed AS (
           UPDATE outbox_message
           SET status = $1, claimed_at = now()
           WHERE id IN (
             SELECT id FROM outbox_message
             WHERE destination = $2
               AND (status = $3
                    OR (status = $1 AND claimed_at < now() - make_interval(secs => $4)))
             ORDER BY created_at
             LIMIT $5
             FOR UPDATE SKIP LOCKED
           )
           RETURNING *
         )
         SELECT * FROM claimed ORDER BY created_at`,
        [
          OUTBOX_MESSAGE_STATUS.PROCESSING,
          destination,
          OUTBOX_MESSAGE_STATUS.PENDING,
          staleClaimSeconds,
          batchSize,
        ],
      );

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  async markOutboxMessagePublished(id: string): Promise<void> {
    const validId = parseInternal(
      outboxMessageIdSchema,
      id,
      "PgOutboxClaimer.markOutboxMessagePublished",
    );

    try {
      await this.pool.query(
        `UPDATE outbox_message SET status = $1, published_at = now() WHERE id = $2`,
        [OUTBOX_MESSAGE_STATUS.PUBLISHED, validId],
      );
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
