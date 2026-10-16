import { describe, expect, it } from "vitest";
import { Heartbeat } from "@/health/Heartbeat.js";

class FakeClock {
  time = 1_000;

  now = (): number => this.time;
}

function createHeartbeat(clock: FakeClock): Heartbeat {
  return new Heartbeat({ maxSilenceMs: 60_000, now: clock.now });
}

describe("Heartbeat", () => {
  it("is alive when created", () => {
    const heartbeat = createHeartbeat(new FakeClock());

    expect(heartbeat.isAlive()).toBe(true);
  });

  it("is alive at exactly the maximum silence", () => {
    const clock = new FakeClock();
    const heartbeat = createHeartbeat(clock);

    clock.time += 60_000;

    expect(heartbeat.isAlive()).toBe(true);
  });

  it("is not alive after the maximum silence", () => {
    const clock = new FakeClock();
    const heartbeat = createHeartbeat(clock);

    clock.time += 60_001;

    expect(heartbeat.isAlive()).toBe(false);
  });

  it("is alive again after a beat", () => {
    const clock = new FakeClock();
    const heartbeat = createHeartbeat(clock);

    clock.time += 60_001;
    heartbeat.beat();

    expect(heartbeat.isAlive()).toBe(true);
  });
});
