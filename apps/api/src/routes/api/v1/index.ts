import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import type { Resolver } from "../../../di/token.js";
import { workflowRoutes } from "./workflows/index.js";
import { nodeRoutes } from "./nodes/index.js";

export async function v1Routes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Workflow Execution Engine API",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  // Helmet's default CSP blocks Swagger UI's inline scripts — stripped for this version's docs only.
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.includes("/docs")) {
      reply.removeHeader("content-security-policy");
    }

    return payload;
  });

  await app.register(workflowRoutes, { container });
  await app.register(nodeRoutes, { container });
}
