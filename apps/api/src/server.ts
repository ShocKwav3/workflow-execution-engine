import { buildApp } from "./app.js";
import { loadAppConfig, type AppConfig } from "./config.js";
import { buildContainer } from "./dependencies.js";
import type { Container } from "./di/container.js";
import { healthRoutes } from "./routes/health.js";

export async function buildServer(
  config: AppConfig = loadAppConfig(),
  container: Container = buildContainer(),
) {
  const app = await buildApp(config);

  await app.register(healthRoutes, { container });

  return app;
}
