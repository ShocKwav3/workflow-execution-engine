import { z } from "zod";

export const OUTBOX_DESTINATIONS = ["rabbitmq"] as const;

export type OutboxDestination = (typeof OUTBOX_DESTINATIONS)[number];

export const addOutboxMessageInputSchema = z.object({
  destination: z.enum(OUTBOX_DESTINATIONS),
  routingKey: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type AddOutboxMessageInput = z.infer<typeof addOutboxMessageInputSchema>;
