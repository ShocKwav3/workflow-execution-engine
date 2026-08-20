import { DatabaseUnavailableError } from "./DatabaseUnavailableError.js";
import { UniqueConstraintViolationError } from "./UniqueConstraintViolationError.js";
import { ForeignKeyViolationError } from "./ForeignKeyViolationError.js";

const CONNECTION_TIMEOUT_MESSAGE = /timeout exceeded when trying to connect/i;

interface PgDriverError {
  code?: string;
  message?: string;
}

function isPgDriverError(error: unknown): error is PgDriverError {
  return typeof error === "object" && error !== null;
}

// Only translates errors we can confidently classify — everything else is rethrown unchanged.
export function classifyPgError(error: unknown): Error {
  if (!isPgDriverError(error)) {
    return error as Error;
  }

  if (!error.code && error.message && CONNECTION_TIMEOUT_MESSAGE.test(error.message)) {
    return new DatabaseUnavailableError(error);
  }

  if (error.code === "23505") {
    return new UniqueConstraintViolationError(error);
  }

  if (error.code === "23503") {
    return new ForeignKeyViolationError(error);
  }

  return error as Error;
}
