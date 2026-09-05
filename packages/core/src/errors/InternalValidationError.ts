// Not a ClassifiedError: no classification maps to 5xx, and this is our bug, not the caller's.
export class InternalValidationError extends Error {
  readonly context: string;

  constructor(context: string, cause: unknown) {
    super(`Internal validation failed: ${context}`, { cause });
    this.name = "InternalValidationError";
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}
