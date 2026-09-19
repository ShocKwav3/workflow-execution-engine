import { messageConsumerToken } from "@workflow-engine/core/amqp/tokens.js";
import { loadLogConfig } from "@workflow-engine/core/config/logConfig.js";
import type { Container } from "@workflow-engine/core/di/container.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import { createLogger } from "@workflow-engine/core/logging/logger.js";
import { ExecutorRuntime } from "./ExecutorRuntime.js";
import { buildContainer } from "./registrations.js";
import { StartWorkflowExecutionHandler } from "./StartWorkflowExecutionHandler.js";

// Must stay below docker stop's 10s and Kubernetes' terminationGracePeriodSeconds (default 30).
const SHUTDOWN_TIMEOUT_MS = 8_000;

const logger = createLogger(loadLogConfig());
const lifecycleLogger = createContextLogger(logger, "Lifecycle");

let container: Container | undefined;
let runtime: ExecutorRuntime | undefined;
let shuttingDown = false;

async function close(): Promise<void> {
  try {
    await runtime?.stop();
  } finally {
    await container?.dispose();
  }
}

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

  const [closed] = await Promise.allSettled([close()]);

  clearTimeout(forceExit);

  if (closed.status === "rejected") {
    lifecycleLogger.error({ err: closed.reason }, "error during shutdown");
    process.exit(1);
  }

  process.exit(exitCode);
}

// stop() rejects a still-pending consume(), so a failure seen during shutdown is not a failure.
function onConsumerFailure(reason: string, error: unknown): void {
  if (shuttingDown) {
    return;
  }

  lifecycleLogger.fatal({ err: error }, reason);
  void shutdown(reason, 1);
}

process.once("SIGTERM", () => void shutdown("received SIGTERM", 0));
process.once("SIGINT", () => void shutdown("received SIGINT", 0));

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

// Construction happens under the handlers above, so a startup failure is logged, not printed raw.
try {
  container = buildContainer(logger);
  runtime = new ExecutorRuntime(
    container.resolve(messageConsumerToken),
    new StartWorkflowExecutionHandler(createContextLogger(logger, "StartWorkflowExecution")),
  );

  // Not awaited: with the broker down the process stays up and subscribes once it appears.
  void runtime
    .start()
    .catch((error: unknown) => onConsumerFailure("consumer failed to start", error));
  void runtime
    .finished()
    .catch((error: unknown) => onConsumerFailure("consumer stopped unrecoverably", error));

  lifecycleLogger.info("executor started");
} catch (error) {
  lifecycleLogger.fatal({ err: error }, "executor failed to start");
  process.exit(1);
}
