import { Redis } from "ioredis";
import type { Disposable } from "@/di/types.js";
import type { Logger } from "@/logging/types.js";
import { RedisConnectionMonitor } from "./RedisConnectionMonitor.js";

export interface RedisConnectionOptions {
  url: string;
  enableOfflineQueue?: boolean;
  commandTimeoutMs?: number;
}

export class RedisConnection implements Disposable {
  private readonly redis: Redis;

  constructor(options: RedisConnectionOptions, logger: Logger) {
    const monitor = new RedisConnectionMonitor(logger);

    // Only set what the caller set, so everything else keeps ioredis' defaults.
    this.redis = new Redis(options.url, {
      ...(options.enableOfflineQueue !== undefined
        ? { enableOfflineQueue: options.enableOfflineQueue }
        : {}),
      ...(options.commandTimeoutMs !== undefined
        ? { commandTimeout: options.commandTimeoutMs }
        : {}),
    });
    this.redis.on("ready", () => monitor.onReady());
    this.redis.on("close", () => monitor.onClose());
    this.redis.on("error", (error: Error) => monitor.onError(error));
  }

  // Libraries such as BullMQ take the driver instance itself.
  get client(): Redis {
    return this.redis;
  }

  isReady(): boolean {
    return this.redis.status === "ready";
  }

  // QUIT needs a live connection; otherwise stop the reconnect loop directly.
  async dispose(): Promise<void> {
    if (this.redis.status === "ready") {
      await this.redis.quit();

      return;
    }

    this.redis.disconnect();
  }
}
