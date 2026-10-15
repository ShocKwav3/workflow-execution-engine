import type { DependencyStatusRecord } from "./DependencyStatusRecord.js";
import type { DependencyStatus, ReadinessSource, ReadinessVerdict, WorkerPhase } from "./types.js";

export class WorkerReadiness implements ReadinessSource {
  private phase: WorkerPhase = "starting";

  constructor(private readonly dependencies: Record<string, DependencyStatusRecord>) {}

  // A late start signal must not make a stopping worker ready again.
  markRunning(): void {
    if (this.phase === "starting") {
      this.phase = "running";
    }
  }

  markStopping(): void {
    this.phase = "stopping";
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
}
