import type { TransactionRunner } from "../transaction.js";
import type { WorkflowExecutionOutbox } from "../outbox/WorkflowExecutionOutbox.js";
import type { WorkflowExecutionWriter } from "./WorkflowExecutionWriter.js";

export interface WorkflowExecutionTransactionScope {
  workflowExecutions: WorkflowExecutionWriter;
  workflowExecutionOutbox: WorkflowExecutionOutbox;
}

export type WorkflowExecutionUnitOfWork = TransactionRunner<WorkflowExecutionTransactionScope>;
