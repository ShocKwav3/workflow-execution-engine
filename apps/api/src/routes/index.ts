import type { FastifyInstance } from "fastify";
import type { Resolver } from "../di/token.js";
import { healthRoutes } from "./health.js";
import { workflowRoutes } from "./workflows/index.js";
import { executionRoutes } from "./executions/index.js";

// New route context (e.g. routes/steps/) — add its import + one register call here.
// server.ts registers this file only; it never grows when a new resource folder shows up.
export async function registerRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  await app.register(healthRoutes, { container });
  await app.register(workflowRoutes, { container, prefix: "/api" });
  await app.register(executionRoutes, { container, prefix: "/api" });
}
