import { UnregisteredTokenError } from "./errors.js";
import type { Factory, Lifetime, Registration, Token, TrackingResolver } from "./types.js";

export class Container implements TrackingResolver {
  private readonly registrations = new Map<Token<unknown>, Registration<unknown>>();
  private readonly singletons = new Map<Token<unknown>, unknown>();

  register<T>(token: Token<T>, factory: Factory<T>, lifetime: Lifetime = "factory"): void {
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

  hasResolved<T>(token: Token<T>): boolean {
    return this.singletons.has(token);
  }
}
