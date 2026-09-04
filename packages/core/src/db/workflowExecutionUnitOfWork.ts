import type { TransactionRunner } from "./transaction.js";
import type { WorkflowExecutionWriter } from "./workflowExecutionWriter.js";

export interface WorkflowExecutionTransactionScope {
  workflowExecutions: WorkflowExecutionWriter;
}

export type WorkflowExecutionUnitOfWork = TransactionRunner<WorkflowExecutionTransactionScope>;
