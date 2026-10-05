import { ClassifiedError, type ErrorContext } from "@workflow-engine/core/errors/index.js";

// Another worker changed this execution mid-run; only a lost-lock zombie can cause it.
export class ExecutionStateConflictError extends ClassifiedError {
  constructor(message: string, context: ErrorContext) {
    super("CONFLICT", "EXECUTION_STATE_CONFLICT", message, { context });
    this.name = "ExecutionStateConflictError";
  }
}
