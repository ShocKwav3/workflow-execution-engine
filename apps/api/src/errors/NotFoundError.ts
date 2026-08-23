import { AppError } from "./AppError.js";
import type { ErrorContext } from "./ClassifiedError.js";

export class NotFoundError extends AppError {
  constructor(detail: string, context?: ErrorContext) {
    super(404, "NOT_FOUND", "Not Found", detail, context ? { context } : undefined);
    this.name = "NotFoundError";
  }
}
