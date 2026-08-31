import { ClassifiedError, type ErrorContext } from "@/errors/ClassifiedError.js";

export class WorkflowVersionMismatchError extends ClassifiedError {
  constructor(context: ErrorContext) {
    super(
      "INVALID_REFERENCE",
      "WORKFLOW_VERSION_MISMATCH",
      "The workflow version does not belong to this workflow",
      { context },
    );
    this.name = "WorkflowVersionMismatchError";
  }
}
