import type { Container } from "@workflow-engine/core/di/container.js";
import { loadLogConfig } from "@workflow-engine/core/config/logConfig.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import { createLogger } from "@workflow-engine/core/logging/logger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { buildContainer } from "./registrations.js";
import { pollerToken } from "./tokens.js";

// Must stay below docker stop's 10s and Kubernetes' terminationGracePeriodSeconds (default 30).
const SHUTDOWN_TIMEOUT_MS = 8_000;

let logger: Logger;

// Nothing else can report a failure to build the logger itself, e.g. an unknown LOG_LEVEL.
try {
  logger = createLogger(loadLogConfig());
} catch (error) {
  console.error("outbox relay failed to create its logger", error);
  process.exit(1);
}

const lifecycleLogger = createContextLogger(logger, "Lifecycle");

let container: Container | undefined;
let shuttingDown = false;

async function shutdown(reason: string, exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  lifecycleLogger.info(`${reason} — shutting down`);

  const forceExit = setTimeout(() => {
    lifecycleLogger.error(`shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceExit.unref();

  const [disposed] = await Promise.allSettled([container?.dispose()]);

  clearTimeout(forceExit);

  if (disposed.status === "rejected") {
    lifecycleLogger.error({ err: disposed.reason }, "error during shutdown");
    process.exit(1);
  }

  lifecycleLogger.info("shutdown complete");
  process.exit(exitCode);
}

process.on("SIGTERM", () => void shutdown("received SIGTERM", 0));
process.on("SIGINT", () => void shutdown("received SIGINT", 0));

process.on("unhandledRejection", (reason: unknown) => {
  lifecycleLogger.fatal(
    { err: reason instanceof Error ? reason : new Error(String(reason)) },
    "unhandled promise rejection",
  );
  void shutdown("unhandled promise rejection", 1);
});

process.on("uncaughtException", (error: Error) => {
  lifecycleLogger.fatal({ err: error }, "uncaught exception");
  void shutdown("uncaught exception", 1);
});

// Resolution happens under the handlers above, so a startup failure is logged, not printed raw.
try {
  container = buildContainer(logger);
  container.resolve(pollerToken).start();
  lifecycleLogger.info({}, "outbox relay started");
} catch (error) {
  lifecycleLogger.fatal({ err: error }, "outbox relay failed to start");
  process.exit(1);
}
