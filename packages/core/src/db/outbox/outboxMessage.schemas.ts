import type { z } from "zod";
import { outboxMessageSchema } from "@/schemas/outboxMessage.schemas.js";

export const createOutboxMessageInputSchema = outboxMessageSchema.pick({
  destination: true,
  messageType: true,
  payload: true,
  correlationId: true,
});

export type CreateOutboxMessageInput = z.infer<typeof createOutboxMessageInputSchema>;
