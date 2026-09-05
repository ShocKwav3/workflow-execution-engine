import { randomUUID } from "node:crypto";
import { z } from "zod";

export const START_WORKFLOW_EXECUTION = "StartWorkflowExecution";

export const startWorkflowExecutionMessageSchema = z.object({
  messageId: z.uuid(),
  correlationId: z.uuid(),
  type: z.literal(START_WORKFLOW_EXECUTION),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    workflowExecutionId: z.uuid(),
  }),
});

export type StartWorkflowExecutionMessage = z.infer<typeof startWorkflowExecutionMessageSchema>;

export function createStartWorkflowExecutionMessage(
  workflowExecutionId: string,
): StartWorkflowExecutionMessage {
  return startWorkflowExecutionMessageSchema.parse({
    messageId: randomUUID(),
    // Stopgap: no inbound correlation id reaches this boundary yet, so one is minted per command.
    correlationId: randomUUID(),
    type: START_WORKFLOW_EXECUTION,
    occurredAt: new Date().toISOString(),
    payload: { workflowExecutionId },
  });
}
