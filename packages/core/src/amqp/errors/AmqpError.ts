import { ClassifiedError, type ErrorContext } from "@/errors/index.js";

// AMQP failures are always UNAVAILABLE — retryable infrastructure failures, never a business-rule conflict.
export class AmqpError extends ClassifiedError {
  constructor(code: string, message: string, cause: unknown, context?: ErrorContext) {
    super("UNAVAILABLE", code, message, { cause, context: context ?? {} });
    this.name = "AmqpError";
  }
}
