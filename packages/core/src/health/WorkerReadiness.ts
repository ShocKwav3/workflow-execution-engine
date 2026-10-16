import type { Logger } from "@/logging/types.js";
import type { DependencyStatusRecord } from "./DependencyStatusRecord.js";
import type { DependencyStatus, ReadinessSource, ReadinessVerdict, WorkerPhase } from "./types.js";

export class WorkerReadiness implements ReadinessSource {
  private phase: WorkerPhase = "starting";
  private lastReportedReady = false;

  constructor(
    private readonly dependencies: Record<string, DependencyStatusRecord>,
    private readonly logger: Logger,
  ) {
    for (const [name, record] of Object.entries(dependencies)) {
      record.onStateChange((status) => this.dependencyChanged(name, status));
    }
  }

  // A late start signal must not make a stopping worker ready again.
  markRunning(): void {
    if (this.phase === "starting") {
      this.phase = "running";
      this.reportVerdict();
    }
  }

  markStopping(): void {
    this.phase = "stopping";
    this.reportVerdict();
  }

  evaluate(): ReadinessVerdict {
    const dependencies: Record<string, DependencyStatus> = {};
    let allAvailable = true;

    for (const [name, record] of Object.entries(this.dependencies)) {
      const status = record.current();

      dependencies[name] = status;

      if (status.state !== "available") {
        allAvailable = false;
      }
    }

    return {
      ready: this.phase === "running" && allAvailable,
      phase: this.phase,
      dependencies,
    };
  }

  private dependencyChanged(name: string, status: DependencyStatus): void {
    if (status.state === "available") {
      this.logger.info({ dependency: name }, "dependency available");
    } else {
      this.logger.warn({ dependency: name, reason: status.reason }, "dependency unavailable");
    }

    this.reportVerdict();
  }

  // Logs only when the verdict flips; the worker starts as not ready, so startup logs nothing until ready.
  private reportVerdict(): void {
    const verdict = this.evaluate();

    if (verdict.ready === this.lastReportedReady) {
      return;
    }

    this.lastReportedReady = verdict.ready;

    if (verdict.ready) {
      this.logger.info({}, "worker ready");

      return;
    }

    if (verdict.phase === "stopping") {
      this.logger.info({ phase: verdict.phase }, "worker not ready");

      return;
    }

    const unavailable: Record<string, string> = {};

    for (const [name, status] of Object.entries(verdict.dependencies)) {
      if (status.state !== "available") {
        unavailable[name] = status.reason ?? status.state;
      }
    }

    this.logger.warn({ phase: verdict.phase, unavailable }, "worker not ready");
  }
}
