import type { FastifyInstance } from "fastify";
import { AppError } from "@workflow-engine/core/errors/AppError.js";
import { sendProblem } from "./errorHandler.js";

export function registerNotFoundHandler(app: FastifyInstance): void {
  const methods = new Set<string>();

  app.addHook("onRoute", (route) => {
    for (const method of [route.method].flat()) {
      methods.add(method);
    }
  });

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0]!;
    // findRoute matches a concrete path through Fastify's own router, not only a pattern
    const allowed = [...methods].filter(
      (method) => app.findRoute({ method, url: path }) !== null,
    );

    if (allowed.length > 0) {
      reply.header("allow", allowed.join(", "));
      sendProblem(
        reply,
        request,
        new AppError(
          405,
          "METHOD_NOT_ALLOWED",
          "Method Not Allowed",
          `This path does not support ${request.method}`,
        ),
      );

      return;
    }

    sendProblem(reply, request, new AppError(404, "NOT_FOUND", "Not Found", "Route not found"));
  });
}
