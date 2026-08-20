import type { FastifyInstance } from "fastify";
import { pgPoolToken } from "../db/tokens.js";
import type { Resolver } from "../di/token.js";

export async function healthRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/ready", async (request, reply) => {
    const pool = container.resolve(pgPoolToken);

    try {
      await pool.query("SELECT 1");

      return { status: "ok" };
    } catch (error) {
      request.log.error({ err: error }, "readiness check failed: database unreachable");
      reply.status(503);

      return { status: "unavailable" };
    }
  });
}
