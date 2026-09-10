import { z } from "zod";

export const OUTBOX_DESTINATIONS = ["rabbitmq"] as const;

export type OutboxDestination = (typeof OUTBOX_DESTINATIONS)[number];

export const addOutboxMessageInputSchema = z.object({
  destination: z.enum(OUTBOX_DESTINATIONS),
  routingKey: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type AddOutboxMessageInput = z.infer<typeof addOutboxMessageInputSchema>;

export const outboxMessageIdSchema = z.uuid();

export const claimOutboxMessagesInputSchema = z.object({
  destination: z.enum(OUTBOX_DESTINATIONS),
  staleClaimSeconds: z.int32().positive(),
  batchSize: z.int32().positive(),
});

export type ClaimOutboxMessagesInput = z.infer<typeof claimOutboxMessagesInputSchema>;
