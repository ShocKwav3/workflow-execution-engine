import type { PoolClient } from "pg";
import { parseInternal } from "@/errors/index.js";
import { OUTBOX_MESSAGE_STATUS } from "@/schemas/outboxMessage.schemas.js";
import { classifyPgError } from "../errors/index.js";
import {
  type CreateOutboxMessageInput,
  createOutboxMessageInputSchema,
} from "./outboxMessage.schemas.js";
import type { OutboxWriter } from "./OutboxWriter.js";
import type { OutboxMessageRow } from "../types.js";

export class PgOutboxWriter implements OutboxWriter {
  constructor(private readonly client: PoolClient) {}

  async createOutboxMessage(input: CreateOutboxMessageInput): Promise<OutboxMessageRow> {
    const { destination, messageType, payload, correlationId } = parseInternal(
      createOutboxMessageInputSchema,
      input,
      "PgOutboxWriter.createOutboxMessage",
    );

    try {
      const result = await this.client.query<OutboxMessageRow>(
        `INSERT INTO outbox_message (destination, message_type, payload, correlation_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          destination,
          messageType,
          JSON.stringify(payload),
          correlationId,
          OUTBOX_MESSAGE_STATUS.PENDING,
        ],
      );

      return result.rows[0]!;
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
