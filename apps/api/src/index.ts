import { buildServer } from "./server.js";
import { loadAppConfig } from "./config.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";

// Must stay below docker stop's 10s and Kubernetes' terminationGracePeriodSeconds (default 30).
const SHUTDOWN_TIMEOUT_MS = 8_000;

const config = loadAppConfig();
const app = await buildServer(config);
const lifecycleLogger = createContextLogger(app.log, "Lifecycle");

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

  const [closed] = await Promise.allSettled([app.close()]);

  clearTimeout(forceExit);

  if (closed.status === "rejected") {
    lifecycleLogger.error({ err: closed.reason }, "error during shutdown");
    process.exit(1);
  }

  process.exit(exitCode);
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

await app.listen({ host: config.host, port: config.port });
