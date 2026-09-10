import type { Token } from "./types.js";

export class UnregisteredTokenError extends Error {
  constructor(token: Token<unknown>) {
    super(`No registration found for token: ${token.description ?? String(token)}`);
    this.name = "UnregisteredTokenError";
  }
}

export class ContainerDisposedError extends Error {
  constructor(token: Token<unknown>) {
    super(`Container was disposed; cannot resolve token: ${token.description ?? String(token)}`);
    this.name = "ContainerDisposedError";
  }
}
