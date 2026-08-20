import type { FastifyBaseLogger } from "fastify";

export function createContextLogger(logger: FastifyBaseLogger, context: string): FastifyBaseLogger {
  return logger.child({ context }) as FastifyBaseLogger;
}
