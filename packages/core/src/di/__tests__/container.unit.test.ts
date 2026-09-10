import { describe, expect, it, vi } from "vitest";
import { Container } from "@/di/container.js";
import { ContainerDisposedError, UnregisteredTokenError } from "@/di/errors.js";
import { createToken } from "@/di/token.js";

describe("Container", () => {
  it("resolves a singleton to the same instance every time", () => {
    const container = new Container();
    const token = createToken<{ id: number }>("thing");

    container.register(token, () => ({ id: Math.random() }), { lifetime: "singleton" });

    const first = container.resolve(token);
    const second = container.resolve(token);

    expect(first).toBe(second);
  });

  it("resolves a factory to a new instance every time", () => {
    const container = new Container();
    const token = createToken<{ id: number }>("thing");

    container.register(token, () => ({ id: Math.random() }), { lifetime: "factory" });

    const first = container.resolve(token);
    const second = container.resolve(token);

    expect(first).not.toBe(second);
  });

  it("defaults to factory lifetime when none is given", () => {
    const container = new Container();
    const token = createToken<{ id: number }>("thing");

    container.register(token, () => ({ id: Math.random() }));

    const first = container.resolve(token);
    const second = container.resolve(token);

    expect(first).not.toBe(second);
  });

  it("registers a plain value by wrapping it in a factory", () => {
    const container = new Container();
    const token = createToken<{ id: number }>("config");
    const value = { id: 1 };

    container.register(token, () => value, { lifetime: "singleton" });

    const first = container.resolve(token);
    const second = container.resolve(token);

    expect(first).toBe(value);
    expect(first).toBe(second);
  });

  it("throws UnregisteredTokenError for an unregistered token", () => {
    const container = new Container();
    const token = createToken<string>("missing");

    const resolveMissing = () => container.resolve(token);

    expect(resolveMissing).toThrow(UnregisteredTokenError);
  });

  it("gives a factory a resolver that reaches the container's other registrations", () => {
    const container = new Container();
    const dependencyToken = createToken<string>("dependency");
    const consumerToken = createToken<{ dependency: string }>("consumer");

    container.register(dependencyToken, () => "resolved", { lifetime: "singleton" });
    container.register(
      consumerToken,
      (resolver) => ({ dependency: resolver.resolve(dependencyToken) }),
      { lifetime: "singleton" },
    );

    expect(container.resolve(consumerToken).dependency).toBe("resolved");
  });

  it("reports whether a singleton has been constructed without constructing it", () => {
    const container = new Container();
    const token = createToken<string>("thing");

    container.register(token, () => "value", { lifetime: "singleton" });

    expect(container.hasResolved(token)).toBe(false);

    container.resolve(token);

    expect(container.hasResolved(token)).toBe(true);
  });
});

describe("Container disposal", () => {
  it("runs a registration's disposer with the resolved instance", async () => {
    const container = new Container();
    const token = createToken<{ closed: boolean }>("resource");
    const instance = { closed: false };

    container.register(token, () => instance, {
      lifetime: "singleton",
      dispose: (resource) => {
        resource.closed = true;
      },
    });
    container.resolve(token);

    await container.dispose();

    expect(instance.closed).toBe(true);
  });

  it("disposes an instance that implements Disposable without an explicit disposer", async () => {
    const container = new Container();
    const dispose = vi.fn();
    const token = createToken<{ dispose: () => void }>("disposable");

    container.register(token, () => ({ dispose }), { lifetime: "singleton" });
    container.resolve(token);

    await container.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("never disposes something that was only registered, never resolved", async () => {
    const container = new Container();
    const dispose = vi.fn();

    container.register(createToken<object>("unused"), () => ({}), {
      lifetime: "singleton",
      dispose,
    });

    await container.dispose();

    expect(dispose).not.toHaveBeenCalled();
  });

  it("never disposes factory-lifetime instances, since it does not keep them", async () => {
    const container = new Container();
    const dispose = vi.fn();
    const token = createToken<object>("transient");

    container.register(token, () => ({}), { lifetime: "factory", dispose });
    container.resolve(token);

    await container.dispose();

    expect(dispose).not.toHaveBeenCalled();
  });

  it("disposes in reverse resolution order, so dependencies outlive their dependents", async () => {
    const container = new Container();
    const order: string[] = [];
    const poolToken = createToken<object>("pool");
    const readerToken = createToken<object>("reader");

    container.register(poolToken, () => ({}), {
      lifetime: "singleton",
      dispose: () => {
        order.push("pool");
      },
    });
    container.register(readerToken, (resolver) => ({ pool: resolver.resolve(poolToken) }), {
      lifetime: "singleton",
      dispose: () => {
        order.push("reader");
      },
    });
    container.resolve(readerToken);

    await container.dispose();

    expect(order).toEqual(["reader", "pool"]);
  });

  it("awaits an asynchronous disposer before finishing", async () => {
    const container = new Container();
    const token = createToken<object>("slow");
    let finished = false;

    container.register(token, () => ({}), {
      lifetime: "singleton",
      dispose: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        finished = true;
      },
    });
    container.resolve(token);

    await container.dispose();

    expect(finished).toBe(true);
  });

  it("runs every disposer even when one throws, reporting the failures together", async () => {
    const container = new Container();
    const survivor = vi.fn();
    const failingToken = createToken<object>("failing");
    const survivingToken = createToken<object>("surviving");

    container.register(survivingToken, () => ({}), {
      lifetime: "singleton",
      dispose: survivor,
    });
    container.register(failingToken, () => ({}), {
      lifetime: "singleton",
      dispose: () => {
        throw new Error("close failed");
      },
    });
    container.resolve(survivingToken);
    container.resolve(failingToken);

    await expect(container.dispose()).rejects.toBeInstanceOf(AggregateError);

    expect(survivor).toHaveBeenCalledOnce();
  });

  it("is idempotent, so a second shutdown signal cannot double-close", async () => {
    const container = new Container();
    const dispose = vi.fn();
    const token = createToken<object>("resource");

    container.register(token, () => ({}), { lifetime: "singleton", dispose });
    container.resolve(token);

    await container.dispose();
    await container.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("refuses to resolve after disposal instead of quietly rebuilding the instance", async () => {
    const container = new Container();
    const factory = vi.fn(() => ({}));
    const token = createToken<object>("resource");

    container.register(token, factory, { lifetime: "singleton" });
    container.resolve(token);

    await container.dispose();

    expect(() => container.resolve(token)).toThrow(ContainerDisposedError);
    expect(factory).toHaveBeenCalledOnce();
  });
});
