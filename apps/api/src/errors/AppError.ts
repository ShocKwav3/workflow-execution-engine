export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: { cause?: unknown; details?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
  }
}
