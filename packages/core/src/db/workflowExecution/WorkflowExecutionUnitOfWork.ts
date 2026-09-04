import type { TransactionRunner } from "../transaction.js";
import type { WorkflowExecutionWriter } from "./WorkflowExecutionWriter.js";

export interface WorkflowExecutionTransactionScope {
  workflowExecutions: WorkflowExecutionWriter;
}

export type WorkflowExecutionUnitOfWork = TransactionRunner<WorkflowExecutionTransactionScope>;
