import { DatabaseError } from "./DatabaseError.js";

export class UniqueConstraintViolationError extends DatabaseError {
  constructor(cause: unknown) {
    super("CONFLICT", "UNIQUE_VIOLATION", "A row with the same unique value already exists", cause);
    this.name = "UniqueConstraintViolationError";
  }
}
