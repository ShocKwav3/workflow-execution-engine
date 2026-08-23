import { ClassifiedError, type ErrorContext } from "../ClassifiedError.js";

export class NodeOrderingMismatchError extends ClassifiedError {
  constructor(context: ErrorContext) {
    super(
      "CONFLICT",
      "NODE_ORDERING_MISMATCH",
      "A reorder must list every node of the version exactly once",
      { context },
    );
    this.name = "NodeOrderingMismatchError";
  }
}
