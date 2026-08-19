const CONNECTION_TIMEOUT_MESSAGE = /timeout exceeded when trying to connect/i;

export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Database unavailable: timed out acquiring a connection");
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}

export class UniqueConstraintViolationError extends Error {
  constructor(cause: unknown) {
    super("A row with the same unique value already exists");
    this.name = "UniqueConstraintViolationError";
    this.cause = cause;
  }
}

export class ForeignKeyViolationError extends Error {
  constructor(cause: unknown) {
    super("Referenced row does not exist or does not match an invariant");
    this.name = "ForeignKeyViolationError";
    this.cause = cause;
  }
}

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
