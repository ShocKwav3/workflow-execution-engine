import { DatabaseError } from "./DatabaseError.js";

export class DatabaseUnavailableError extends DatabaseError {
  constructor(cause: unknown) {
    super(
      "UNAVAILABLE",
      "DATABASE_UNAVAILABLE",
      "Database unavailable: timed out acquiring a connection",
      cause,
    );
    this.name = "DatabaseUnavailableError";
  }
}
