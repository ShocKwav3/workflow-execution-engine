export type Token<T> = symbol & { readonly __type?: T };

export type Lifetime = "singleton" | "factory";

export type Factory<T> = (resolver: Resolver) => T;

export type Disposer<T> = (instance: T) => Promise<void> | void;

// Implemented by concrete types that own a resource — deliberately never by the port they are
// registered under, so a consumer that resolves the port cannot tear it down.
export interface Disposable {
  dispose(): Promise<void> | void;
}

export interface RegistrationOptions<T> {
  lifetime?: Lifetime;
  dispose?: Disposer<T>;
}

export interface Registration<T> {
  factory: Factory<T>;
  lifetime: Lifetime;
  dispose?: Disposer<T>;
}

export interface Resolver {
  resolve<T>(token: Token<T>): T;
}

export interface TrackingResolver extends Resolver {
  hasResolved<T>(token: Token<T>): boolean;
}
