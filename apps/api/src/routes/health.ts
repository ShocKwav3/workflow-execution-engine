import type { FastifyInstance } from "fastify";
import { pgPoolToken } from "@/db/tokens.js";
import type { Resolver } from "@/di/types.js";

export async function healthRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  app.setChildLoggerFactory((logger, bindings, opts) => {
    bindings.context = "HealthCheck";

    return logger.child(bindings, opts);
  });

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
