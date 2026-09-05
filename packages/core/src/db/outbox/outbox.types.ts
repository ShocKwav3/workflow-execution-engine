import type { OutboxDestination } from "./outbox.schemas.js";

export type OutboxMessageStatus = "PENDING" | "PROCESSING" | "PUBLISHED";

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
