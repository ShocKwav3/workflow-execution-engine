import { z } from "zod";
import { correlationIdSchema } from "./correlation.schemas.js";

export const outboxMessageStatusSchema = z.enum(["PENDING", "PROCESSING", "PUBLISHED"]);

export const OUTBOX_MESSAGE_STATUS = outboxMessageStatusSchema.enum;

export type OutboxMessageStatus = z.infer<typeof outboxMessageStatusSchema>;

export const outboxDestinationSchema = z.enum(["bullmq"]);

export const OUTBOX_DESTINATION = outboxDestinationSchema.enum;

export type OutboxDestination = z.infer<typeof outboxDestinationSchema>;

export const outboxMessageSchema = z.object({
  id: z.uuid(),
  destination: outboxDestinationSchema,
  messageType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  correlationId: correlationIdSchema,
  status: outboxMessageStatusSchema,
  claimToken: z.uuid(),
});
