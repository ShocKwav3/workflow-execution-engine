import { DatabaseError } from "../db/errors/index.js";
import { AppError } from "./AppError.js";

export function translateDatabaseError(error: unknown): AppError | undefined {
  if (!(error instanceof DatabaseError)) {
    return undefined;
  }

  switch (error.classification) {
    case "CONFLICT":
      return new AppError(409, "CONFLICT", error.message, { cause: error });
    case "INVALID_REFERENCE":
      return new AppError(400, "INVALID_REFERENCE", error.message, { cause: error });
    case "UNAVAILABLE":
      return new AppError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable", {
        cause: error,
      });
  }
}
