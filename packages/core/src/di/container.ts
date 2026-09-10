import { ContainerDisposedError, UnregisteredTokenError } from "./errors.js";
import type {
  Disposable,
  Factory,
  Registration,
  RegistrationOptions,
  Token,
  TrackingResolver,
} from "./types.js";

function isDisposable(instance: unknown): instance is Disposable {
  return (
    typeof instance === "object" &&
    instance !== null &&
    typeof (instance as Disposable).dispose === "function"
  );
}

export class Container implements TrackingResolver {
  private readonly registrations = new Map<Token<unknown>, Registration<unknown>>();
  private readonly singletons = new Map<Token<unknown>, unknown>();
  private readonly disposers: Array<() => Promise<void>> = [];
  private disposed = false;

  register<T>(token: Token<T>, factory: Factory<T>, options: RegistrationOptions<T> = {}): void {
    const registration: Registration<T> = {
      factory,
      lifetime: options.lifetime ?? "factory",
      ...(options.dispose ? { dispose: options.dispose } : {}),
    };

    this.registrations.set(token, registration as Registration<unknown>);
  }

  resolve<T>(token: Token<T>): T {
    if (this.disposed) {
      throw new ContainerDisposedError(token);
    }

    const registration = this.registrations.get(token) as Registration<T> | undefined;

    if (!registration) {
      throw new UnregisteredTokenError(token);
    }

    if (registration.lifetime === "singleton") {
      if (!this.singletons.has(token)) {
        const instance = registration.factory(this);

        this.singletons.set(token, instance);

        // Only singletons are cached, so only singletons can be disposed — a factory registration
        // hands out instances the container never sees again.
        const dispose = registration.dispose;

        if (dispose) {
          this.disposers.push(async () => {
            await dispose(instance);
          });
        } else if (isDisposable(instance)) {
          this.disposers.push(async () => {
            await instance.dispose();
          });
        }
      }

      return this.singletons.get(token) as T;
    }

    return registration.factory(this);
  }

  hasResolved<T>(token: Token<T>): boolean {
    return this.singletons.has(token);
  }

  // Reverse resolution order, so a dependency is never torn down before its dependents. Every
  // disposer runs even if an earlier one throws; the failures surface together afterwards.
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    const disposers = this.disposers.splice(0).reverse();
    const failures: unknown[] = [];

    for (const dispose of disposers) {
      try {
        await dispose();
      } catch (error) {
        failures.push(error);
      }
    }

    this.singletons.clear();

    if (failures.length > 0) {
      throw new AggregateError(failures, "one or more disposers failed");
    }
  }
}
