import { buildApp } from "./app.js";
import { loadAppConfig, type AppConfig } from "./config.js";
import { buildContainer } from "./dependencies.js";
import type { Container } from "./di/container.js";
import { closePgPool } from "./db/pool.js";
import { pgPoolToken } from "./db/tokens.js";
import { registerRoutes } from "./routes/index.js";

export async function buildServer(config: AppConfig = loadAppConfig(), container?: Container) {
  const app = await buildApp(config);
  const resolvedContainer = container ?? buildContainer(app.log);

  await app.register(registerRoutes, { container: resolvedContainer });

  // Only closes the pool if something actually resolved it — don't force it into existence.
  app.addHook("onClose", async () => {
    if (resolvedContainer.hasResolved(pgPoolToken)) {
      await closePgPool(resolvedContainer.resolve(pgPoolToken));
    }
  });

  return app;
}
