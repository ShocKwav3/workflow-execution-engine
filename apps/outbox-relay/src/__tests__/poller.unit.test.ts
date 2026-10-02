import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { createPoller, type Poller } from "@/poller.js";

const INTERVAL_MS = 1_000;
const MAX_BACKOFF_MS = 5_000;

function recordingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger: Logger = {
    child: () => logger,
    info: (_obj, msg) => lines.push(`info:${msg ?? ""}`),
    warn: (_obj, msg) => lines.push(`warn:${msg ?? ""}`),
    error: (_obj, msg) => lines.push(`error:${msg ?? ""}`),
    fatal: (_obj, msg) => lines.push(`fatal:${msg ?? ""}`),
  };

  return { logger, lines };
}

describe("createPoller", () => {
  let poller: Poller | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await poller?.stop();
    poller = undefined;
    vi.useRealTimers();
  });

  function start(tick: () => Promise<boolean>, logger = recordingLogger().logger): Poller {
    poller = createPoller({ intervalMs: INTERVAL_MS, maxBackoffMs: MAX_BACKOFF_MS, logger, tick });
    poller.start();

    return poller;
  }

  it("runs the first tick right after start", async () => {
    const tick = vi.fn(async () => false);

    start(tick);
    await vi.advanceTimersByTimeAsync(0);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("waits the interval after a tick that reports no more work", async () => {
    const tick = vi.fn(async () => false);

    start(tick);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS - 1);

    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("runs again without waiting while ticks report more work", async () => {
    const results = [true, true, false];
    const tick = vi.fn(async () => results.shift() ?? false);

    start(tick);

    // The fake clock runs a zero-delay timer created during a tick 1 ms later, not at once.
    await vi.advanceTimersByTimeAsync(INTERVAL_MS / 10);

    expect(tick).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS - INTERVAL_MS / 10 - 10);

    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially on failure, capped, and logs the outage and recovery once", async () => {
    const { logger, lines } = recordingLogger();
    let failuresLeft = 3;
    const tick = vi.fn(async () => {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error("database unavailable");
      }

      return false;
    });

    start(tick, logger);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(tick).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(tick).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);
    expect(tick).toHaveBeenCalledTimes(4);

    expect(lines).toEqual([
      "info:poll loop started",
      "error:poll cycle failed; backing off",
      "info:poll cycle recovered",
    ]);
  });

  it("waits for the in-flight tick on stop and runs no further ticks", async () => {
    let finishTick: (moreWaiting: boolean) => void = () => {};

    const tick = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishTick = resolve;
        }),
    );

    const running = start(tick);

    await vi.advanceTimersByTimeAsync(0);

    let stopped = false;
    const stopping = running.stop().then(() => {
      stopped = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);

    finishTick(true);
    await stopping;
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 10);

    expect(stopped).toBe(true);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
