import type {
  ClaimOutboxMessagesInput,
  MarkOutboxMessagePublishedInput,
} from "./outboxMessage.schemas.js";
import type { OutboxMessageRow } from "../types.js";

export interface OutboxRelay {
  claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<OutboxMessageRow[]>;
  // false means the claim was lost to another claimer; expected, not an error.
  markOutboxMessagePublished(input: MarkOutboxMessagePublishedInput): Promise<boolean>;
}
