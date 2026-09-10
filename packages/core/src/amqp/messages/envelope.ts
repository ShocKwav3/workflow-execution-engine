import { z } from "zod";

// What every message shares, and all a generic publisher needs to understand — payload-specific
// contracts are validated by the process that writes them and the one that consumes them.
export const messageEnvelopeSchema = z.object({
  messageId: z.uuid(),
  correlationId: z.uuid(),
  type: z.string().trim().min(1),
  occurredAt: z.iso.datetime(),
  payload: z.unknown(),
});

export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;
