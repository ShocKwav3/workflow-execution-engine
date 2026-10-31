import { ClassifiedError, type ErrorContext } from "@/errors/ClassifiedError.js";

export class WorkflowNotFoundError extends ClassifiedError {
  constructor(context: ErrorContext) {
    super("NOT_FOUND", "NOT_FOUND", "Workflow not found", { context });
    this.name = "WorkflowNotFoundError";
  }
}
