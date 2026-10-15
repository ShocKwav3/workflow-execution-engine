import type { DependencyStatus, DependencyStatusRecord } from "./DependencyStatusRecord.js";

export type WorkerPhase = "starting" | "running" | "stopping";

export interface ReadinessVerdict {
  ready: boolean;
  phase: WorkerPhase;
  dependencies: Record<string, DependencyStatus>;
}

export class WorkerReadiness {
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
