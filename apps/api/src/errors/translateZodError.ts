import { ZodError } from "zod";
import { AppError } from "./AppError.js";

export function translateZodError(error: unknown): AppError | undefined {
  if (!(error instanceof ZodError)) {
    return undefined;
  }

  return new AppError(400, "VALIDATION_ERROR", "Bad Request", "Request validation failed", {
    cause: error,
    errors: error.issues,
  });
}
