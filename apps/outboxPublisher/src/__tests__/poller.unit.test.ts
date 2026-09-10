import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { createPoller } from "@/poller.js";

const testLogger = (): Logger => {
  const logger: Logger = {
    child: () => logger,
    info: () => {},
    warn: () => {},
    error: vi.fn(),
    fatal: () => {},
  };

  return logger;
};

describe("poll loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a tick once per interval", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const poller = createPoller({ intervalMs: 100, logger: testLogger(), tick });

    poller.start();
    await vi.advanceTimersByTimeAsync(300);

    expect(tick).toHaveBeenCalledTimes(3);

    await poller.stop();
  });

  it("does not start a tick while the previous one is still running", async () => {
    let release: (() => void) | undefined;
    const tick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const poller = createPoller({ intervalMs: 100, logger: testLogger(), tick });

    poller.start();
    await vi.advanceTimersByTimeAsync(500);

    expect(tick).toHaveBeenCalledTimes(1);

    release?.();
    await poller.stop();
  });

  it("logs a failed tick and keeps polling", async () => {
    const logger = testLogger();
    const tick = vi
      .fn()
      .mockRejectedValueOnce(new Error("claim failed"))
      .mockResolvedValue(undefined);
    const poller = createPoller({ intervalMs: 100, logger, tick });

    poller.start();
    await vi.advanceTimersByTimeAsync(200);

    expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "poll cycle failed");
    expect(tick).toHaveBeenCalledTimes(2);

    await poller.stop();
  });

  it("stops scheduling further ticks once stopped", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const poller = createPoller({ intervalMs: 100, logger: testLogger(), tick });

    poller.start();
    await vi.advanceTimersByTimeAsync(100);
    await poller.stop();
    await vi.advanceTimersByTimeAsync(500);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("waits for an in-flight tick before resolving stop", async () => {
    let release: (() => void) | undefined;
    let finished = false;
    const tick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            finished = true;
            resolve();
          };
        }),
    );
    const poller = createPoller({ intervalMs: 100, logger: testLogger(), tick });

    poller.start();
    await vi.advanceTimersByTimeAsync(100);

    const stopped = poller.stop().then(() => finished);

    release?.();

    await expect(stopped).resolves.toBe(true);
  });
});
