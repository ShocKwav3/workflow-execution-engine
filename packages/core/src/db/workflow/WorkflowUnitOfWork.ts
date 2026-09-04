import type { TransactionRunner } from "../transaction.js";
import type { WorkflowWriter } from "./WorkflowWriter.js";

export interface WorkflowTransactionScope {
  workflows: WorkflowWriter;
}

export type WorkflowUnitOfWork = TransactionRunner<WorkflowTransactionScope>;
