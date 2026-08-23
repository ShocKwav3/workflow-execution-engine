export type ErrorClassification = "CONFLICT" | "INVALID_REFERENCE" | "UNAVAILABLE";

export type ErrorContext = Record<string, unknown>;

// context is for logs only — never copied into a response body.
export class ClassifiedError extends Error {
  readonly classification: ErrorClassification;
  readonly code: string;
  readonly context: ErrorContext;

  constructor(
    classification: ErrorClassification,
    code: string,
    message: string,
    options?: { cause?: unknown; context?: ErrorContext },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ClassifiedError";
    this.classification = classification;
    this.code = code;
    this.context = options?.context ?? {};
    Error.captureStackTrace(this, this.constructor);
  }
}
