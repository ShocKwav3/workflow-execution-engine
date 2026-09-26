import type { CreateOutboxMessageInput } from "./outboxMessage.schemas.js";
import type { OutboxMessageRow } from "../types.js";

export interface OutboxWriter {
  createOutboxMessage(input: CreateOutboxMessageInput): Promise<OutboxMessageRow>;
}
