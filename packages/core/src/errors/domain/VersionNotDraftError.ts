import { ClassifiedError, type ErrorContext } from "@/errors/ClassifiedError.js";

export class VersionNotDraftError extends ClassifiedError {
  constructor(version: number, context: ErrorContext) {
    super(
      "CONFLICT",
      "VERSION_NOT_DRAFT",
      `Workflow version ${version} is published and cannot be modified`,
      { context },
    );
    this.name = "VersionNotDraftError";
  }
}
