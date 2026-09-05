// Which node types this application can actually run — a deployment concern, not workflow
// data. Empty until an executor exists; a real handler is what makes a type valid.
export const NODE_TYPES: Record<string, unknown> = {};
