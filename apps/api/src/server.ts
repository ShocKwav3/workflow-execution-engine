import { buildApp } from "./app.js";
import { loadAppConfig, type AppConfig } from "./config.js";
import { buildContainer } from "./registrations.js";
import { registerRoutes } from "./routes/index.js";

export async function buildServer(config: AppConfig = loadAppConfig()) {
  const app = await buildApp(config);
  const container = buildContainer(app.log);

  await app.register(registerRoutes, { container });

  app.addHook("onClose", async () => {
    await container.dispose();
  });

  return app;
}
