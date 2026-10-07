import { setTimeout } from "node:timers/promises";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import type { NodeWork, NodeWorkInput } from "./NodeWork.js";

export interface SimulatedNodeWorkOptions {
  crash?: () => void;
  sleep?: (ms: number) => Promise<unknown>;
}

export class SimulatedNodeWork implements NodeWork {
  private readonly crash: () => void;
  private readonly sleep: (ms: number) => Promise<unknown>;

  constructor(
    private readonly logger: Logger,
    options: SimulatedNodeWorkOptions = {},
  ) {
    this.crash = options.crash ?? (() => process.exit(1));
    this.sleep = options.sleep ?? setTimeout;
  }

  async perform({
    executionId,
    nodeExecutionId,
    config,
    attemptNumber,
  }: NodeWorkInput): Promise<void> {
    const duringRetry = config.crash?.duringRetry;

    // duringRetry 0 is the first attempt, 1 the first retry, and so on.
    if (duringRetry !== undefined && attemptNumber === duringRetry + 1) {
      this.logger.fatal({ executionId, nodeExecutionId, attemptNumber }, "simulated crash");
      this.crash();
    }

    // Must stay async: a blocked event loop stops BullMQ's lock renewal and looks like a dead worker.
    await this.sleep((config.durationSeconds ?? 0) * 1000);
  }
}
