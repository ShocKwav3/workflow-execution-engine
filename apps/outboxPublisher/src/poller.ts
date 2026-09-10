import type { Logger } from "@workflow-engine/core/logging/types.js";

export interface PollerOptions {
  intervalMs: number;
  logger: Logger;
  tick: () => Promise<void>;
}

export interface Poller {
  start(): void;
  stop(): Promise<void>;
}

export function createPoller({ intervalMs, logger, tick }: PollerOptions): Poller {
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;
  let running = false;

  async function runTick(): Promise<void> {
    if (inFlight) {
      return;
    }

    inFlight = tick()
      .catch((error: unknown) => {
        logger.error({ err: error }, "poll cycle failed");
      })
      .finally(() => {
        inFlight = undefined;
      });

    await inFlight;
  }

  return {
    start(): void {
      if (running) {
        return;
      }

      running = true;
      timer = setInterval(() => void runTick(), intervalMs);
      logger.info({ intervalMs }, "poll loop started");
    },

    async stop(): Promise<void> {
      running = false;

      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }

      await inFlight;
      logger.info("poll loop stopped");
    },
  };
}
