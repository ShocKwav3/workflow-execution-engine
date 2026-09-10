import type { ClaimOutboxMessagesInput } from "./outbox.schemas.js";
import type { OutboxMessageRow } from "./outbox.types.js";

export interface OutboxClaimer {
  claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<OutboxMessageRow[]>;
  markOutboxMessagePublished(id: string): Promise<void>;
}
