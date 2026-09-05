import type { StartWorkflowExecutionMessage } from "@/amqp/messages/startWorkflowExecution.js";

export interface WorkflowExecutionOutbox {
  addStartCommand(command: StartWorkflowExecutionMessage): Promise<void>;
}
