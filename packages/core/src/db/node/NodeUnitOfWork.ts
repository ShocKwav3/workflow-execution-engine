import type { TransactionRunner } from "../transaction.js";
import type { NodeWriter } from "./NodeWriter.js";

export interface NodeTransactionScope {
  nodes: NodeWriter;
}

export type NodeUnitOfWork = TransactionRunner<NodeTransactionScope>;
