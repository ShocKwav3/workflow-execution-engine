import type { FastifyInstance } from "fastify";
import type { Resolver } from "../di/token.js";
import { healthRoutes } from "./health.js";
import { v1Routes } from "./api/v1/index.js";

// New route context (e.g. routes/api/v2/) — add its import + one register call here.
// server.ts registers this file only; it never grows when a new resource/version shows up.
export async function registerRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  await app.register(healthRoutes, { container });
  await app.register(v1Routes, { container, prefix: "/api/v1" });
}
