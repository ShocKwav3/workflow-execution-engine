import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DependencyChecker } from "@/health/DependencyChecker.js";
import { DependencyStatusRecord } from "@/health/DependencyStatusRecord.js";

const OPTIONS = { intervalMs: 5_000, timeoutMs: 2_000 };

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function hangingCheck() {
  return vi.fn(() => new Promise<void>(() => {}));
}

describe("DependencyChecker", () => {
  let record: DependencyStatusRecord;
  let checker: DependencyChecker | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    record = new DependencyStatusRecord({ expiryMs: 12_000 });
  });

  afterEach(() => {
    checker?.dispose();
    vi.useRealTimers();
  });

  it("marks the record available when the check succeeds", async () => {
    checker = new DependencyChecker(record, async () => {}, OPTIONS);

    checker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(record.current().state).toBe("available");
  });

  it("marks the record unavailable with the error message when the check fails", async () => {
    checker = new DependencyChecker(
      record,
      async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
      },
      OPTIONS,
    );

    checker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(record.current()).toMatchObject({
      state: "unavailable",
      reason: "connect ECONNREFUSED 127.0.0.1:5432",
    });
  });

  it("marks the record unavailable when the check does not settle within the timeout", async () => {
    checker = new DependencyChecker(record, hangingCheck(), OPTIONS);

    checker.start();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(record.current().state).toBe("unknown");

    await vi.advanceTimersByTimeAsync(1);
    expect(record.current()).toMatchObject({ state: "unavailable", reason: "check timed out" });
  });

  it("does not start a second check while the first one is still in flight", async () => {
    const check = hangingCheck();

    checker = new DependencyChecker(record, check, OPTIONS);

    checker.start();
    await vi.advanceTimersByTimeAsync(3 * OPTIONS.intervalMs);

    expect(check).toHaveBeenCalledTimes(1);
  });

  it("runs one more check after the current one settles when a check is requested meanwhile", async () => {
    const first = deferred();
    const check = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);

    checker = new DependencyChecker(record, check, OPTIONS);

    checker.start();
    checker.requestCheck();
    checker.requestCheck();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(check).toHaveBeenCalledTimes(2);
  });

  it("rejects the result of a check that started before a connection loss", async () => {
    const first = deferred();

    checker = new DependencyChecker(record, () => first.promise, OPTIONS);

    checker.start();
    record.connectionLost("connection closed");
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(record.current()).toMatchObject({
      state: "unavailable",
      reason: "connection closed",
      generation: 1,
    });
  });

  it("skips the check and leaves the record unknown while not connected", async () => {
    const check = vi.fn(async () => {});

    checker = new DependencyChecker(record, check, { ...OPTIONS, isConnected: () => false });

    checker.start();
    await vi.advanceTimersByTimeAsync(2 * OPTIONS.intervalMs);

    expect(check).not.toHaveBeenCalled();
    expect(record.current().state).toBe("unknown");
  });

  it("starts no more checks after dispose", async () => {
    const check = vi.fn(async () => {});

    checker = new DependencyChecker(record, check, OPTIONS);

    checker.start();
    await vi.advanceTimersByTimeAsync(0);
    checker.dispose();
    await vi.advanceTimersByTimeAsync(3 * OPTIONS.intervalMs);

    expect(check).toHaveBeenCalledTimes(1);
  });
});
