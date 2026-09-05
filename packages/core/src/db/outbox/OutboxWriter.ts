import type { AddOutboxMessageInput } from "./outbox.schemas.js";

export interface OutboxWriter {
  addOutboxMessage(input: AddOutboxMessageInput): Promise<void>;
}
