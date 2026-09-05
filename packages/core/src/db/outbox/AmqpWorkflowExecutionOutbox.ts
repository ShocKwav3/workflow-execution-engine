import type { StartWorkflowExecutionMessage } from "@/amqp/messages/startWorkflowExecution.js";
import { AMQP_TOPOLOGY } from "@/amqp/topology.js";
import type { OutboxWriter } from "./OutboxWriter.js";
import type { WorkflowExecutionOutbox } from "./WorkflowExecutionOutbox.js";

export class AmqpWorkflowExecutionOutbox implements WorkflowExecutionOutbox {
  constructor(private readonly outbox: OutboxWriter) {}

  async addStartCommand(command: StartWorkflowExecutionMessage): Promise<void> {
    await this.outbox.addOutboxMessage({
      destination: "rabbitmq",
      routingKey: AMQP_TOPOLOGY.routingKey,
      payload: command,
    });
  }
}
