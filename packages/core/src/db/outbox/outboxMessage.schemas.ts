import { z } from "zod";
import { outboxMessageSchema } from "@/schemas/outboxMessage.schemas.js";

export const createOutboxMessageInputSchema = outboxMessageSchema.pick({
  destination: true,
  messageType: true,
  payload: true,
  correlationId: true,
});

export type CreateOutboxMessageInput = z.infer<typeof createOutboxMessageInputSchema>;

export const claimOutboxMessagesInputSchema = outboxMessageSchema
  .pick({ destination: true })
  .extend({
    batchSize: z.int32().positive(),
    leaseMs: z.int32().positive(),
  });

export type ClaimOutboxMessagesInput = z.infer<typeof claimOutboxMessagesInputSchema>;

export const markOutboxMessagePublishedInputSchema = outboxMessageSchema.pick({
  id: true,
  claimToken: true,
});

export type MarkOutboxMessagePublishedInput = z.infer<typeof markOutboxMessagePublishedInputSchema>;
