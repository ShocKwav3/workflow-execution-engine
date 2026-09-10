import type { OutboxDestination } from "./outbox.schemas.js";

export const OUTBOX_MESSAGE_STATUSES = ["PENDING", "PROCESSING", "PUBLISHED"] as const;

export type OutboxMessageStatus = (typeof OUTBOX_MESSAGE_STATUSES)[number];

// Mirrors the CHECK constraint on outbox_message.status — a fourth state needs both changed.
export const OUTBOX_MESSAGE_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
} as const satisfies Record<string, OutboxMessageStatus>;

export interface OutboxMessageRow {
  id: string;
  destination: OutboxDestination;
  routing_key: string;
  payload: unknown;
  status: OutboxMessageStatus;
  claimed_at: Date | null;
  published_at: Date | null;
  created_at: Date;
}
