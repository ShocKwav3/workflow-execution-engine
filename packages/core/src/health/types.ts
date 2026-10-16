export type DependencyState = "unknown" | "available" | "unavailable";

export interface DependencyStatus {
  state: DependencyState;
  reason?: string;
  observedAt: number;
  generation: number;
}

export type WorkerPhase = "starting" | "running" | "stopping";

export interface ReadinessVerdict {
  ready: boolean;
  phase: WorkerPhase;
  dependencies: Record<string, DependencyStatus>;
}

export interface ReadinessSource {
  evaluate(): { ready: boolean };
}

export type LivenessCheck = () => boolean;
