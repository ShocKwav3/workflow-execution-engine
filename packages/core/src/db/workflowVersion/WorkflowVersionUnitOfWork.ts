import type { TransactionRunner } from "../transaction.js";
import type { WorkflowVersionWriter } from "./WorkflowVersionWriter.js";

export interface WorkflowVersionTransactionScope {
  workflowVersions: WorkflowVersionWriter;
}

export type WorkflowVersionUnitOfWork = TransactionRunner<WorkflowVersionTransactionScope>;
