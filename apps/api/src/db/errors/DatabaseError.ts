export type DatabaseErrorClassification = "CONFLICT" | "INVALID_REFERENCE" | "UNAVAILABLE";

// cause carries the original driver error for logging only — never sent to the client.
export class DatabaseError extends Error {
  readonly classification: DatabaseErrorClassification;

  constructor(classification: DatabaseErrorClassification, message: string, cause: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.classification = classification;
    this.cause = cause;
  }
}
