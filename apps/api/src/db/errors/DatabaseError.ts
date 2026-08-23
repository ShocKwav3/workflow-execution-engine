import {
  ClassifiedError,
  type ErrorClassification,
  type ErrorContext,
} from "../../errors/index.js";

// cause carries the original driver error for logging only — never sent to the client.
export class DatabaseError extends ClassifiedError {
  constructor(
    classification: ErrorClassification,
    code: string,
    message: string,
    cause: unknown,
    context?: ErrorContext,
  ) {
    super(classification, code, message, { cause, context: context ?? {} });
    this.name = "DatabaseError";
  }
}
