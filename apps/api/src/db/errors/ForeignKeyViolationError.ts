import { DatabaseError } from "./DatabaseError.js";

export class ForeignKeyViolationError extends DatabaseError {
  constructor(cause: unknown) {
    super(
      "INVALID_REFERENCE",
      "Referenced row does not exist or does not match an invariant",
      cause,
    );
    this.name = "ForeignKeyViolationError";
  }
}
