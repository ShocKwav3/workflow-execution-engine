import { buildApp } from "./app.js";
import { loadAppConfig, type AppConfig } from "./config.js";
import { buildContainer } from "./registrations.js";
import { closePgPool } from "@workflow-engine/core/db/pool.js";
import { pgPoolToken } from "@workflow-engine/core/db/tokens.js";
import { registerRoutes } from "./routes/index.js";

export async function buildServer(config: AppConfig = loadAppConfig()) {
  const app = await buildApp(config);
  const container = buildContainer(app.log);

  await app.register(registerRoutes, { container });

  // Only closes the pool if something actually resolved it — don't force it into existence.
  app.addHook("onClose", async () => {
    if (container.hasResolved(pgPoolToken)) {
      await closePgPool(container.resolve(pgPoolToken));
    }
  });

  return app;
}
