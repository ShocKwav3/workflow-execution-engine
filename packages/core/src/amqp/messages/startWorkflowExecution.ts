import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseInternal } from "@/errors/index.js";
import { messageEnvelopeSchema } from "./envelope.js";

export const START_WORKFLOW_EXECUTION = "StartWorkflowExecution";

export const startWorkflowExecutionMessageSchema = messageEnvelopeSchema.extend({
  type: z.literal(START_WORKFLOW_EXECUTION),
  payload: z.object({
    workflowExecutionId: z.uuid(),
  }),
});

export type StartWorkflowExecutionMessage = z.infer<typeof startWorkflowExecutionMessageSchema>;

export function createStartWorkflowExecutionMessage(
  workflowExecutionId: string,
): StartWorkflowExecutionMessage {
  return parseInternal(
    startWorkflowExecutionMessageSchema,
    {
      messageId: randomUUID(),
      // Stopgap: no inbound correlation id reaches this boundary yet, so one is minted per command.
      correlationId: randomUUID(),
      type: START_WORKFLOW_EXECUTION,
      occurredAt: new Date().toISOString(),
      payload: { workflowExecutionId },
    },
    "createStartWorkflowExecutionMessage",
  );
}
