import type { FastifyInstance } from "fastify";

type ChildLoggerFactory = Parameters<FastifyInstance["setChildLoggerFactory"]>[0];

export function createLoggerFactory(context: string): ChildLoggerFactory {
  return (logger, bindings, opts) => {
    bindings.context = context;

    return logger.child(bindings, opts);
  };
}
