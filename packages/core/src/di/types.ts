export type Token<T> = symbol & { readonly __type?: T };

export type Lifetime = "singleton" | "factory";

export type Factory<T> = (resolver: Resolver) => T;

export interface Registration<T> {
  factory: Factory<T>;
  lifetime: Lifetime;
}

export interface Resolver {
  resolve<T>(token: Token<T>): T;
}

export interface TrackingResolver extends Resolver {
  hasResolved<T>(token: Token<T>): boolean;
}
