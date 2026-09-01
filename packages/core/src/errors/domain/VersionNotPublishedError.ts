import { ClassifiedError, type ErrorContext } from "@/errors/ClassifiedError.js";

export class VersionNotPublishedError extends ClassifiedError {
  constructor(version: number, context: ErrorContext) {
    super(
      "CONFLICT",
      "VERSION_NOT_PUBLISHED",
      `Workflow version ${version} must be published before it can be executed`,
      { context },
    );
    this.name = "VersionNotPublishedError";
  }
}
