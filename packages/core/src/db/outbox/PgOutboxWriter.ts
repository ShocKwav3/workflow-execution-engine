import type { PoolClient } from "pg";
import { classifyPgError } from "../errors/index.js";
import { type AddOutboxMessageInput, addOutboxMessageInputSchema } from "./outbox.schemas.js";
import { OutboxMessageValidationError } from "./OutboxMessageValidationError.js";
import type { OutboxWriter } from "./OutboxWriter.js";

export class PgOutboxWriter implements OutboxWriter {
  constructor(private readonly client: PoolClient) {}

  async addOutboxMessage(input: AddOutboxMessageInput): Promise<void> {
    const parsed = addOutboxMessageInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new OutboxMessageValidationError(parsed.error);
    }

    const { destination, routingKey, payload } = parsed.data;

    try {
      await this.client.query(
        `INSERT INTO outbox_message (destination, routing_key, payload) VALUES ($1, $2, $3)`,
        [destination, routingKey, payload],
      );
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
