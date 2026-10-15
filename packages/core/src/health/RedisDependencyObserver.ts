import type { EventEmitter } from "node:events";
import type { Disposable } from "@/di/types.js";
import type { DependencyStatusRecord } from "./DependencyStatusRecord.js";

export class RedisDependencyObserver implements Disposable {
  private lastError: string | undefined;

  constructor(
    private readonly client: EventEmitter,
    private readonly record: DependencyStatusRecord,
    private readonly onReady: () => void,
  ) {}

  subscribe(): void {
    this.client.on("error", this.handleError);
    this.client.on("close", this.handleClose);
    this.client.on("ready", this.handleReady);
  }

  dispose(): void {
    this.client.off("error", this.handleError);
    this.client.off("close", this.handleClose);
    this.client.off("ready", this.handleReady);
  }

  // A socket emits 'error' directly before 'close', so the error is kept as the reason for the close.
  private readonly handleError = (error: Error): void => {
    this.lastError = error.message;
  };

  private readonly handleClose = (): void => {
    this.record.connectionLost(this.lastError ?? "connection closed");
    this.lastError = undefined;
  };

  private readonly handleReady = (): void => {
    this.onReady();
  };
}
