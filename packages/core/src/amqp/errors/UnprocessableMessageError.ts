// Thrown by a handler for a message that can never succeed; not an AmqpError, the broker is fine.
export class UnprocessableMessageError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`Unprocessable message: ${reason}`, { cause });
    this.name = "UnprocessableMessageError";
    Error.captureStackTrace(this, this.constructor);
  }
}
