import type { Logger } from "@workflow-engine/core/logging/types.js";

export interface PollerOptions {
  intervalMs: number;
  maxBackoffMs: number;
  logger: Logger;
  // Resolves true when more work is waiting, so the next tick runs without waiting.
  tick: () => Promise<boolean>;
}

export interface Poller {
  start(): void;
  stop(): Promise<void>;
}

export function createPoller({ intervalMs, maxBackoffMs, logger, tick }: PollerOptions): Poller {
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;
  let running = false;
  let consecutiveFailures = 0;

  function schedule(delayMs: number): void {
    timer = setTimeout(() => {
      timer = undefined;
      inFlight = runTick();
    }, delayMs);
  }

  async function runTick(): Promise<void> {
    let delayMs = intervalMs;

    try {
      const moreWaiting = await tick();

      if (consecutiveFailures > 0) {
        logger.info({ failures: consecutiveFailures }, "poll cycle recovered");
        consecutiveFailures = 0;
      }

      if (moreWaiting) {
        delayMs = 0;
      }
    } catch (error) {
      consecutiveFailures += 1;
      delayMs = Math.min(intervalMs * 2 ** consecutiveFailures, maxBackoffMs);

      // One line per outage, not one per retry; recovery is logged above.
      if (consecutiveFailures === 1) {
        logger.error({ err: error, retryInMs: delayMs }, "poll cycle failed; backing off");
      }
    }

    if (running) {
      schedule(delayMs);
    }
  }

  return {
    start(): void {
      if (running) {
        return;
      }

      running = true;
      schedule(0);
      logger.info({ intervalMs, maxBackoffMs }, "poll loop started");
    },

    async stop(): Promise<void> {
      running = false;

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      await inFlight;
      logger.info({}, "poll loop stopped");
    },
  };
}
