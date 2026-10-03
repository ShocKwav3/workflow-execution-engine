import type { TransactionRunner } from "../transaction.js";
import type { NodeExecutionWriter } from "./NodeExecutionWriter.js";

export interface NodeExecutionTransactionScope {
  nodeExecutions: NodeExecutionWriter;
}

export type NodeExecutionUnitOfWork = TransactionRunner<NodeExecutionTransactionScope>;
