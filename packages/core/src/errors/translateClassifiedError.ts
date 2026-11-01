import { ClassifiedError } from "./ClassifiedError.js";
import { AppError } from "./AppError.js";

export function translateClassifiedError(error: unknown): AppError | undefined {
  if (!(error instanceof ClassifiedError)) {
    return undefined;
  }

  const options = { cause: error, context: error.context };

  switch (error.classification) {
    case "CONFLICT":
      return new AppError(409, error.code, "Conflict", error.message, options);
    case "INVALID_REFERENCE":
      return new AppError(422, error.code, "Unprocessable Content", error.message, options);
    case "NOT_FOUND":
      return new AppError(404, error.code, "Not Found", error.message, options);
    case "UNAVAILABLE":
      return new AppError(
        503,
        error.code,
        "Service Unavailable",
        "The service is temporarily unavailable",
        options,
      );
  }
}
