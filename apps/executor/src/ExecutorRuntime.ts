import type { MessageConsumer } from "@workflow-engine/core/amqp/MessageConsumer.js";
import type { StartWorkflowExecutionHandler } from "./StartWorkflowExecutionHandler.js";

export class ExecutorRuntime {
  constructor(
    private readonly consumer: MessageConsumer,
    private readonly handler: StartWorkflowExecutionHandler,
  ) {}

  /** Resolves once subscribed; with the broker down it waits for it. */
  start(): Promise<void> {
    return this.consumer.consume((message) => this.handler.handle(message));
  }

  /** Rejects when consumption ended unrecoverably. */
  finished(): Promise<void> {
    return this.consumer.finished();
  }

  stop(): Promise<void> {
    return this.consumer.stop();
  }
}
