import type { Disposable } from "@/di/types.js";
import type { DependencyStatusRecord } from "./DependencyStatusRecord.js";

export interface DependencyCheckerOptions {
  intervalMs: number;
  timeoutMs: number;
  isConnected?: () => boolean;
}

export class DependencyChecker implements Disposable {
  private intervalTimer: ReturnType<typeof setInterval> | undefined;
  private timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private pending = false;
  private disposed = false;

  constructor(
    private readonly record: DependencyStatusRecord,
    private readonly check: () => Promise<unknown>,
    private readonly options: DependencyCheckerOptions,
  ) {}

  start(): void {
    this.requestCheck();
    this.intervalTimer = setInterval(() => this.tick(), this.options.intervalMs);
  }

  requestCheck(): void {
    if (this.inFlight) {
      this.pending = true;

      return;
    }

    void this.run();
  }

  dispose(): void {
    this.disposed = true;
    this.pending = false;
    clearInterval(this.intervalTimer);
    clearTimeout(this.timeoutTimer);
  }

  private tick(): void {
    if (!this.inFlight) {
      void this.run();
    }
  }

  private async run(): Promise<void> {
    if (this.options.isConnected && !this.options.isConnected()) {
      return;
    }

    const generation = this.record.generation;
    let timedOut = false;

    this.inFlight = true;
    this.timeoutTimer = setTimeout(() => {
      timedOut = true;
      this.record.markUnavailable(generation, "check timed out");
    }, this.options.timeoutMs);

    // A timed-out query still holds its pool client, so the check stays in flight until it settles.
    try {
      await this.check();

      if (!timedOut) {
        this.record.markAvailable(generation);
      }
    } catch (error) {
      if (!timedOut) {
        this.record.markUnavailable(generation, errorMessage(error));
      }
    } finally {
      clearTimeout(this.timeoutTimer);
      this.inFlight = false;
    }

    if (this.pending && !this.disposed) {
      this.pending = false;
      void this.run();
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
