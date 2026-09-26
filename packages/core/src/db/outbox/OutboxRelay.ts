import type { ClaimOutboxMessagesInput } from "./outboxMessage.schemas.js";
import type { OutboxMessageRow } from "../types.js";

export interface OutboxRelay {
  claimOutboxMessages(input: ClaimOutboxMessagesInput): Promise<OutboxMessageRow[]>;
}
