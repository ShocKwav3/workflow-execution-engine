import { DatabaseError } from "./DatabaseError.js";

export class ForeignKeyViolationError extends DatabaseError {
  constructor(cause: unknown) {
    super(
      "INVALID_REFERENCE",
      "FOREIGN_KEY_VIOLATION",
      "Referenced row does not exist or does not match an invariant",
      cause,
    );
    this.name = "ForeignKeyViolationError";
  }
}
