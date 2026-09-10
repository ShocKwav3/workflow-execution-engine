import type { ClaimOutboxMessagesInput } from "./outbox.schemas.js";
import type { OutboxMessageRow } from "./outbox.types.js";

export interface OutboxClaimer {
  claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<OutboxMessageRow[]>;
  // Resolves false when no PROCESSING row matched — the claim was lost or already marked.
  markOutboxMessagePublished(id: string): Promise<boolean>;
}
