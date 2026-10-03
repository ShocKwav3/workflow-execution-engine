import type { NodeExecutionAttemptRow } from "../types.js";

export interface NodeExecutionWriter {
  abandonRunningAttempts(nodeExecutionId: string): Promise<number>;
  createAttempt(nodeExecutionId: string): Promise<NodeExecutionAttemptRow>;
  markNodeExecutionRunning(nodeExecutionId: string): Promise<boolean>;
  completeAttempt(attemptId: string): Promise<boolean>;
  markNodeExecutionCompleted(nodeExecutionId: string): Promise<boolean>;
}
