export type Token<T> = symbol & { readonly __type?: T };

export function createToken<T>(description: string): Token<T> {
  return Symbol(description) as Token<T>;
}

export interface Resolver {
  resolve<T>(token: Token<T>): T;
}
