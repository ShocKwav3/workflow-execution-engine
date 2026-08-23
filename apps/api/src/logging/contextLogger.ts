import type { FastifyBaseLogger, FastifyInstance } from "fastify";

export function createContextLogger(logger: FastifyBaseLogger, context: string): FastifyBaseLogger {
  return logger.child({ context }) as FastifyBaseLogger;
}

type ChildLoggerFactory = Parameters<FastifyInstance["setChildLoggerFactory"]>[0];

export function createLoggerFactory(context: string): ChildLoggerFactory {
  return (logger, bindings, opts) => {
    bindings.context = context;

    return logger.child(bindings, opts);
  };
}
