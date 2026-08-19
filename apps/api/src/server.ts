import { buildApp } from "./app.js";
import { loadAppConfig, type AppConfig } from "./config.js";
import { buildContainer } from "./dependencies.js";
import type { Container } from "./di/container.js";
import { closePgPool, pgPoolToken } from "./db/pool.js";
import { healthRoutes } from "./routes/health.js";

export async function buildServer(
  config: AppConfig = loadAppConfig(),
  container: Container = buildContainer(),
) {
  const app = await buildApp(config);

  await app.register(healthRoutes, { container });

  // Cascades from app.close() — the pool is closed whenever the server shuts
  // down, however that's triggered (signal handler, tests, etc.), rather than
  // needing a separate process-level handler tied to the pool specifically.
  // Only closes it if something actually resolved it first (e.g. a /ready hit)
  // — shutdown shouldn't force the pool into existence just to close it.
  app.addHook("onClose", async () => {
    if (container.hasResolved(pgPoolToken)) {
      await closePgPool(container.resolve(pgPoolToken));
    }
  });

  return app;
}
