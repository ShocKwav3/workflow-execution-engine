import { describe, expect, it } from "vitest";
import { DependencyStatusRecord } from "@/health/DependencyStatusRecord.js";

class FakeClock {
  time = 1_000;

  now = (): number => this.time;
}

function createRecord(clock: FakeClock): DependencyStatusRecord {
  return new DependencyStatusRecord({ expiryMs: 12_000, now: clock.now });
}

describe("DependencyStatusRecord", () => {
  it("starts as unknown in generation 0", () => {
    const record = createRecord(new FakeClock());

    expect(record.current()).toEqual({ state: "unknown", observedAt: 1_000, generation: 0 });
  });

  it("stores a result from the current generation", () => {
    const clock = new FakeClock();
    const record = createRecord(clock);

    clock.time = 2_000;
    const accepted = record.markAvailable(record.generation);

    expect(accepted).toBe(true);
    expect(record.current()).toEqual({ state: "available", observedAt: 2_000, generation: 0 });
  });

  it("stores the failure reason of an unavailable result", () => {
    const record = createRecord(new FakeClock());

    record.markUnavailable(record.generation, "check timed out");

    expect(record.current()).toMatchObject({ state: "unavailable", reason: "check timed out" });
  });

  it("drops the previous reason when the dependency becomes available", () => {
    const record = createRecord(new FakeClock());

    record.markUnavailable(record.generation, "check timed out");
    record.markAvailable(record.generation);

    expect(record.current().reason).toBeUndefined();
  });

  it("makes a previous success invalid at once when the connection is lost", () => {
    const record = createRecord(new FakeClock());

    record.markAvailable(record.generation);

    record.connectionLost("connection closed");

    expect(record.current()).toMatchObject({
      state: "unavailable",
      reason: "connection closed",
      generation: 1,
    });
  });

  it("rejects a result from an older generation", () => {
    const record = createRecord(new FakeClock());
    const checkGeneration = record.generation;

    record.connectionLost("connection closed");
    const accepted = record.markAvailable(checkGeneration);

    expect(accepted).toBe(false);
    expect(record.current()).toMatchObject({ state: "unavailable", generation: 1 });
  });

  it("becomes available again after a check in the new generation succeeds", () => {
    const record = createRecord(new FakeClock());

    record.markAvailable(record.generation);
    record.connectionLost("connection closed");

    const accepted = record.markAvailable(record.generation);

    expect(accepted).toBe(true);
    expect(record.current()).toMatchObject({ state: "available", generation: 1 });
    expect(record.current().reason).toBeUndefined();
  });

  it("reports an available result as unavailable after the expiry time", () => {
    const clock = new FakeClock();
    const record = createRecord(clock);

    record.markAvailable(record.generation);

    clock.time += 12_000;
    expect(record.current().state).toBe("available");

    clock.time += 1;
    expect(record.current()).toMatchObject({ state: "unavailable", reason: "result expired" });
  });

  it("does not expire an unknown or unavailable result into a different state", () => {
    const clock = new FakeClock();
    const unknown = createRecord(clock);
    const unavailable = createRecord(clock);

    unavailable.markUnavailable(unavailable.generation, "connection refused");

    clock.time += 60_000;

    expect(unknown.current().state).toBe("unknown");
    expect(unavailable.current()).toMatchObject({
      state: "unavailable",
      reason: "connection refused",
    });
  });

  it("calls the state listener on a change of state only", () => {
    const record = createRecord(new FakeClock());
    const states: string[] = [];

    record.onStateChange((status) => states.push(status.state));

    record.markAvailable(record.generation);
    record.markAvailable(record.generation);
    record.connectionLost("connection closed");
    record.connectionLost("connect ECONNREFUSED 127.0.0.1:6379");
    record.markUnavailable(record.generation, "check timed out");
    record.markAvailable(record.generation);

    expect(states).toEqual(["available", "unavailable", "available"]);
  });

  it("does not call the state listener for a rejected result", () => {
    const record = createRecord(new FakeClock());
    const states: string[] = [];
    const staleGeneration = record.generation;

    record.connectionLost("connection closed");
    record.onStateChange((status) => states.push(status.state));
    record.markAvailable(staleGeneration);

    expect(states).toEqual([]);
  });
});
