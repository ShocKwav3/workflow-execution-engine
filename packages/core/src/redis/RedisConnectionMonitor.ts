import type { Logger } from "@/logging/types.js";

// Turns connection events into one log line per state change or distinct failure cause.
export class RedisConnectionMonitor {
  private connected = false;
  private lastErrorKey: string | undefined;

  constructor(private readonly logger: Logger) {}

  onReady(): void {
    this.connected = true;
    this.lastErrorKey = undefined;
    this.logger.info({}, "redis connection ready");
  }

  onClose(): void {
    if (this.connected) {
      this.connected = false;
      this.logger.warn({}, "redis connection lost; reconnecting");
    }
  }

  // Each reconnect attempt raises a new error object, so causes are compared by code and message.
  onError(error: Error & { code?: string }): void {
    const key = `${error.code ?? ""}:${error.message}`;

    if (key === this.lastErrorKey) {
      return;
    }

    this.lastErrorKey = key;
    this.logger.warn({ err: error }, "redis unavailable");
  }
}
