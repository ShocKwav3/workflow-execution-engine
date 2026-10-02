import type {
  ClaimOutboxMessagesInput,
  MarkOutboxMessagePublishedInput,
} from "./outboxMessage.schemas.js";
import type { ClaimedOutboxMessageRow } from "../types.js";

export interface OutboxClaimer {
  claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<ClaimedOutboxMessageRow[]>;
  // false means the claim was lost to another claimer; expected, not an error.
  markOutboxMessagePublished(input: MarkOutboxMessagePublishedInput): Promise<boolean>;
}
