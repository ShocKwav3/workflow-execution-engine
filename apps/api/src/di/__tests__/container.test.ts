import { describe, expect, it } from "vitest";
import { Container } from "../container.js";
import { UnregisteredTokenError } from "../errors.js";
import { createToken } from "../token.js";

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

  it("lets a test container override a registration without touching the original", () => {
    const container = new Container();
    const token = createToken<string>("greeting");

    container.register(token, () => "real", "singleton");

    const testContainer = container.createTestContainer();

    testContainer.override(token, () => "fake", "singleton");

    const overridden = testContainer.resolve(token);
    const original = container.resolve(token);

    expect(overridden).toBe("fake");
    expect(original).toBe("real");
  });

  it("falls back to the base container for tokens not overridden", () => {
    const container = new Container();
    const token = createToken<string>("untouched");

    container.register(token, () => "original", "singleton");

    const testContainer = container.createTestContainer();
    const resolved = testContainer.resolve(token);

    expect(resolved).toBe("original");
  });
});
