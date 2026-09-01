import { ClassifiedError, type ErrorContext } from "@/errors/ClassifiedError.js";

export class VersionAlreadyPublishedError extends ClassifiedError {
  constructor(version: number, context: ErrorContext) {
    super(
      "CONFLICT",
      "VERSION_ALREADY_PUBLISHED",
      `Workflow version ${version} is already published`,
      { context },
    );
    this.name = "VersionAlreadyPublishedError";
  }
}
