import type { Token } from "./types.js";

export function createToken<T>(description: string): Token<T> {
  return Symbol(description) as Token<T>;
}
