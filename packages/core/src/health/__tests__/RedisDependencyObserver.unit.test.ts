import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { DependencyStatusRecord } from "@/health/DependencyStatusRecord.js";
import { RedisDependencyObserver } from "@/health/RedisDependencyObserver.js";

function setup() {
  const client = new EventEmitter();
  const record = new DependencyStatusRecord({ expiryMs: 12_000, now: () => 1_000 });
  let readyCalls = 0;
  const observer = new RedisDependencyObserver(client, record, () => {
    readyCalls += 1;
  });

  observer.subscribe();

  return { client, record, observer, readyCalls: () => readyCalls };
}

describe("RedisDependencyObserver", () => {
  it("marks the record unavailable with the error message when an error is followed by a close", () => {
    const { client, record } = setup();

    client.emit("error", new Error("connect ECONNREFUSED 127.0.0.1:6379"));
    client.emit("close");

    expect(record.current()).toMatchObject({
      state: "unavailable",
      reason: "connect ECONNREFUSED 127.0.0.1:6379",
      generation: 1,
    });
  });

  it("uses a generic reason when the connection closes without an error", () => {
    const { client, record } = setup();

    client.emit("close");

    expect(record.current()).toMatchObject({ state: "unavailable", reason: "connection closed" });
  });

  it("requests a new check on ready and leaves the record unchanged", () => {
    const { client, record, readyCalls } = setup();
    const before = record.current();

    client.emit("ready");

    expect(readyCalls()).toBe(1);
    expect(record.current()).toEqual(before);
  });

  it("does not reuse the error message of an earlier connection loss", () => {
    const { client, record } = setup();

    client.emit("error", new Error("connect ECONNREFUSED 127.0.0.1:6379"));
    client.emit("close");
    client.emit("ready");
    client.emit("close");

    expect(record.current()).toMatchObject({ reason: "connection closed", generation: 2 });
  });

  it("removes its listeners and ignores events after dispose", () => {
    const { client, record, observer, readyCalls } = setup();

    observer.dispose();
    client.emit("close");
    client.emit("ready");

    expect(record.current()).toMatchObject({ state: "unknown", generation: 0 });
    expect(readyCalls()).toBe(0);
    expect(client.listenerCount("error")).toBe(0);
    expect(client.listenerCount("close")).toBe(0);
    expect(client.listenerCount("ready")).toBe(0);
  });
});
