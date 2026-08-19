import { buildServer } from "./server.js";
import { loadAppConfig } from "./config.js";

const config = loadAppConfig();
const app = await buildServer(config);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info(`Received ${signal}, shutting down`);

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "error during shutdown");
    process.exit(1);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: config.host, port: config.port });
