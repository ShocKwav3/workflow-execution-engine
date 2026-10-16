import type { DependencyState, DependencyStatus } from "./types.js";

export interface DependencyStatusRecordOptions {
  expiryMs: number;
  now?: () => number;
}

export type DependencyStateListener = (status: DependencyStatus) => void;

export class DependencyStatusRecord {
  private status: DependencyStatus;
  private readonly expiryMs: number;
  private readonly now: () => number;
  private listener: DependencyStateListener | undefined;

  constructor(options: DependencyStatusRecordOptions) {
    this.expiryMs = options.expiryMs;
    this.now = options.now ?? Date.now;
    this.status = { state: "unknown", observedAt: this.now(), generation: 0 };
  }

  // A check reads this before it starts and passes it back with its result.
  get generation(): number {
    return this.status.generation;
  }

  // Called on a change of state only, not when only the reason or the time changes.
  onStateChange(listener: DependencyStateListener): void {
    this.listener = listener;
  }

  markAvailable(generation: number): boolean {
    return this.record(generation, "available");
  }

  markUnavailable(generation: number, reason: string): boolean {
    return this.record(generation, "unavailable", reason);
  }

  connectionLost(reason: string): void {
    this.replace({
      state: "unavailable",
      reason,
      observedAt: this.now(),
      generation: this.status.generation + 1,
    });
  }

  current(): DependencyStatus {
    const expired = this.now() - this.status.observedAt > this.expiryMs;

    if (this.status.state === "available" && expired) {
      return { ...this.status, state: "unavailable", reason: "result expired" };
    }

    return { ...this.status };
  }

  private record(generation: number, state: DependencyState, reason?: string): boolean {
    if (generation !== this.status.generation) {
      return false;
    }

    this.replace({
      state,
      ...(reason !== undefined ? { reason } : {}),
      observedAt: this.now(),
      generation,
    });

    return true;
  }

  private replace(next: DependencyStatus): void {
    const changed = next.state !== this.status.state;

    this.status = next;

    if (changed) {
      this.listener?.({ ...next });
    }
  }
}
