import { buildServer } from "./server.js";
import { loadAppConfig } from "./config.js";
import { createContextLogger } from "./logging/contextLogger.js";

const config = loadAppConfig();
const app = await buildServer(config);
const lifecycleLogger = createContextLogger(app.log, "Lifecycle");

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  lifecycleLogger.info(`Received ${signal}, shutting down`);

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    lifecycleLogger.error({ err: error }, "error during shutdown");
    process.exit(1);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: config.host, port: config.port });
