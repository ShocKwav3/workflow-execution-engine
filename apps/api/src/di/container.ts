import { UnregisteredTokenError } from "./errors.js";
import type { Resolver, Token } from "./token.js";

export type Lifetime = "singleton" | "factory";

interface Registration<T> {
  factory: (resolver: Resolver) => T;
  lifetime: Lifetime;
}

export class Container implements Resolver {
  private readonly registrations = new Map<Token<unknown>, Registration<unknown>>();
  private readonly singletons = new Map<Token<unknown>, unknown>();

  register<T>(
    token: Token<T>,
    factory: (resolver: Resolver) => T,
    lifetime: Lifetime = "factory",
  ): void {
    this.registrations.set(token, { factory, lifetime });
  }

  resolve<T>(token: Token<T>): T {
    const registration = this.registrations.get(token) as Registration<T> | undefined;
    if (!registration) {
      throw new UnregisteredTokenError(token);
    }

    if (registration.lifetime === "singleton") {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, registration.factory(this));
      }
      return this.singletons.get(token) as T;
    }

    return registration.factory(this);
  }

  createTestContainer(): TestContainer {
    return new TestContainer(this);
  }
}

export class TestContainer implements Resolver {
  private readonly overrides = new Container();
  private readonly overriddenTokens = new Set<Token<unknown>>();

  constructor(private readonly base: Container) {}

  override<T>(
    token: Token<T>,
    factory: (resolver: Resolver) => T,
    lifetime: Lifetime = "factory",
  ): void {
    this.overrides.register(token, factory, lifetime);
    this.overriddenTokens.add(token);
  }

  resolve<T>(token: Token<T>): T {
    if (this.overriddenTokens.has(token)) {
      return this.overrides.resolve(token);
    }
    return this.base.resolve(token);
  }
}
