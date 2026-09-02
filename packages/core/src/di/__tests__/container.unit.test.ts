import { describe, expect, it } from "vitest";
import { Container } from "@/di/container.js";
import { UnregisteredTokenError } from "@/di/errors.js";
import { createToken } from "@/di/token.js";

describe("Container", () => {
  it("resolves a singleton to the same instance every time", () => {
    const container = new Container();
    const token = createToken<{ id: number }>("thing");

    container.register(token, () => ({ id: Math.random() }), "singleton");

    const first = container.resolve(token);
    const second = container.resolve(token);

    expect(first).toBe(second);
  });

  it("resolves a factory to a new instance every time", () => {
    const container = new Container();
    const token = createToken<{ id: number }>("thing");

    container.register(token, () => ({ id: Math.random() }), "factory");

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

    container.register(token, () => value, "singleton");

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

    container.register(dependencyToken, () => "resolved", "singleton");
    container.register(
      consumerToken,
      (resolver) => ({ dependency: resolver.resolve(dependencyToken) }),
      "singleton",
    );

    expect(container.resolve(consumerToken).dependency).toBe("resolved");
  });

  it("reports whether a singleton has been constructed without constructing it", () => {
    const container = new Container();
    const token = createToken<string>("thing");

    container.register(token, () => "value", "singleton");

    expect(container.hasResolved(token)).toBe(false);

    container.resolve(token);

    expect(container.hasResolved(token)).toBe(true);
  });
});
