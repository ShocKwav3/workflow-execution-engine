import type { TransactionRunner } from "../transaction.js";
import type { OutboxWriter } from "../outbox/OutboxWriter.js";
import type { WorkflowExecutionWriter } from "./WorkflowExecutionWriter.js";

// The outbox is not an aggregate; it rides in this scope so its row commits with the execution.
export interface WorkflowExecutionTransactionScope {
  workflowExecutions: WorkflowExecutionWriter;
  outboxMessages: OutboxWriter;
}

export type WorkflowExecutionUnitOfWork = TransactionRunner<WorkflowExecutionTransactionScope>;
