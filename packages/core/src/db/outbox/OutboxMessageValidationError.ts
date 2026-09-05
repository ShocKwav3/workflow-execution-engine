// Not a ClassifiedError: no classification maps to 5xx, and an invalid outbox row is our bug, not the caller's.
export class OutboxMessageValidationError extends Error {
  constructor(cause: unknown) {
    super("Invalid outbox message", { cause });
    this.name = "OutboxMessageValidationError";
    Error.captureStackTrace(this, this.constructor);
  }
}
