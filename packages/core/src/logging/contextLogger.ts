import type { Logger } from "./types.js";

export function createContextLogger(logger: Logger, context: string): Logger {
  return logger.child({ context });
}
