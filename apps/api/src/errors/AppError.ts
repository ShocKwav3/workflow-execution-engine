import type { ErrorContext } from "./ClassifiedError.js";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly context: ErrorContext;
  readonly errors?: unknown;

  constructor(
    statusCode: number,
    code: string,
    title: string,
    detail: string,
    options?: { cause?: unknown; context?: ErrorContext; errors?: unknown },
  ) {
    super(detail, { cause: options?.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.context = options?.context ?? {};

    if (options?.errors !== undefined) {
      this.errors = options.errors;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}
