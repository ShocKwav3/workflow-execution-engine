import { UnprocessableMessageError } from "@workflow-engine/core/amqp/errors/index.js";
import type { InboundMessage } from "@workflow-engine/core/amqp/MessageConsumer.js";
import {
  type StartWorkflowExecutionMessage,
  startWorkflowExecutionMessageSchema,
} from "@workflow-engine/core/amqp/messages/startWorkflowExecution.js";
import { parseInternal } from "@workflow-engine/core/errors/index.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";

export class StartWorkflowExecutionHandler {
  constructor(private readonly logger: Logger) {}

  async handle({ envelope, redelivered }: InboundMessage): Promise<void> {
    let message: StartWorkflowExecutionMessage;

    try {
      message = parseInternal(
        startWorkflowExecutionMessageSchema,
        envelope,
        "StartWorkflowExecutionHandler.handle",
      );
    } catch (error) {
      // Retrying never fixes a message that breaks its contract, so the consumer drops it.
      throw new UnprocessableMessageError(
        `not a valid StartWorkflowExecution (type ${envelope.type})`,
        error,
      );
    }

    this.logger.info(
      {
        messageId: message.messageId,
        correlationId: message.correlationId,
        workflowExecutionId: message.payload.workflowExecutionId,
        redelivered,
      },
      "StartWorkflowExecution received",
    );
  }
}
