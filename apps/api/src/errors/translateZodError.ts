import { ZodError } from "zod";
import { AppError } from "./AppError.js";

export function translateZodError(error: unknown): AppError | undefined {
  if (!(error instanceof ZodError)) {
    return undefined;
  }

  return new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
    cause: error,
    details: error.issues,
  });
}
