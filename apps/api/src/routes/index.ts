import type { FastifyInstance } from "fastify";
import type { Resolver } from "@workflow-engine/core/di/types.js";
import { V1_PREFIX } from "./v1/config.js";
import { healthRoutes } from "./health.js";
import { v1Routes } from "./v1/index.js";

// New route context (e.g. routes/v2/): add its import + one register call here, not in server.ts.
export async function registerRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  await app.register(healthRoutes, { container });
  await app.register(v1Routes, { container, prefix: V1_PREFIX });
}
