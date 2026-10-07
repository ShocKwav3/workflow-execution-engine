import { describe, expect, it, vi } from "vitest";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import type { NodeConfig } from "@workflow-engine/core/schemas/node.schemas.js";
import { SimulatedNodeWork } from "@/run/SimulatedNodeWork.js";

const IDS = { executionId: "execution-1", nodeExecutionId: "node-execution-1" };

function build() {
  const calls: string[] = [];
  const crash = vi.fn(() => {
    calls.push("crash");
  });
  const sleep = vi.fn(async (ms: number) => {
    calls.push(`sleep ${ms}`);
  });
  const fatal = vi.fn();
  const logger: Logger = {
    child: () => logger,
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal,
  };
  const work = new SimulatedNodeWork(logger, { crash, sleep });
  const perform = (config: NodeConfig, attemptNumber: number) =>
    work.perform({ ...IDS, config, attemptNumber });

  return { perform, crash, sleep, fatal, calls };
}

describe("SimulatedNodeWork", () => {
  it("crashes on the first attempt when duringRetry is 0", async () => {
    const { perform, crash } = build();

    await perform({ crash: { duringRetry: 0 } }, 1);

    expect(crash).toHaveBeenCalledOnce();
  });

  it("crashes only on the attempt matching duringRetry + 1", async () => {
    const { perform, crash } = build();
    const config = { crash: { duringRetry: 1 } };

    await perform(config, 1);
    expect(crash).not.toHaveBeenCalled();

    await perform(config, 2);
    expect(crash).toHaveBeenCalledOnce();

    await perform(config, 3);
    expect(crash).toHaveBeenCalledOnce();
  });

  it("never crashes without crash config", async () => {
    const { perform, crash } = build();

    await perform({ crash: {} }, 1);
    await perform({}, 1);

    expect(crash).not.toHaveBeenCalled();
  });

  it("sleeps durationSeconds in milliseconds", async () => {
    const { perform, sleep } = build();

    await perform({ durationSeconds: 3 }, 1);

    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("sleeps 0 ms when durationSeconds is not set", async () => {
    const { perform, sleep } = build();

    await perform({}, 1);

    expect(sleep).toHaveBeenCalledWith(0);
  });

  it("crashes before doing the work", async () => {
    const { perform, calls } = build();

    await perform({ durationSeconds: 2, crash: { duringRetry: 0 } }, 1);

    expect(calls).toEqual(["crash", "sleep 2000"]);
  });

  it("logs which execution, node and attempt crashed before crashing", async () => {
    const { perform, fatal, crash } = build();

    await perform({ crash: { duringRetry: 0 } }, 1);

    expect(fatal).toHaveBeenCalledWith({ ...IDS, attemptNumber: 1 }, "simulated crash");
    expect(fatal.mock.invocationCallOrder[0]).toBeLessThan(crash.mock.invocationCallOrder[0]!);
  });
});
