// Only the methods this codebase actually calls — deliberately not pino's own `Logger`
// type, which both processes' loggers (Fastify's app.log, a future bare pino instance)
// satisfy in practice but not by declared type (pino v10 requires `msgPrefix`, which
// FastifyBaseLogger doesn't declare, even though app.log is a real pino logger at runtime).
export interface Logger {
  child(bindings: Record<string, unknown>): Logger;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  fatal(obj: unknown, msg?: string): void;
}
