import { ClassifiedError, type ErrorContext } from "@/errors/ClassifiedError.js";

export class VersionHasNoNodesError extends ClassifiedError {
  constructor(version: number, context: ErrorContext) {
    super(
      "CONFLICT",
      "VERSION_HAS_NO_NODES",
      `Workflow version ${version} has no nodes and cannot be published`,
      { context },
    );
    this.name = "VersionHasNoNodesError";
  }
}
