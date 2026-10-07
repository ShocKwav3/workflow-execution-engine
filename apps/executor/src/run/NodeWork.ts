import type { NodeConfig } from "@workflow-engine/core/schemas/node.schemas.js";

export interface NodeWorkInput {
  executionId: string;
  nodeExecutionId: string;
  config: NodeConfig;
  attemptNumber: number;
}

export interface NodeWork {
  perform(input: NodeWorkInput): Promise<void>;
}
