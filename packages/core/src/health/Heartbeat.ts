export interface HeartbeatOptions {
  maxSilenceMs: number;
  now?: () => number;
}

export class Heartbeat {
  private readonly maxSilenceMs: number;
  private readonly now: () => number;
  private lastBeatAt: number;

  // Starts as a beat, so a worker counts as alive until its loop had time to run once.
  constructor(options: HeartbeatOptions) {
    this.maxSilenceMs = options.maxSilenceMs;
    this.now = options.now ?? Date.now;
    this.lastBeatAt = this.now();
  }

  beat(): void {
    this.lastBeatAt = this.now();
  }

  isAlive(): boolean {
    return this.now() - this.lastBeatAt <= this.maxSilenceMs;
  }
}
