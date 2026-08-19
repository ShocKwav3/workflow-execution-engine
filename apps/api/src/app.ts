import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyHelmet from "@fastify/helmet";
import { loadAppConfig, type AppConfig } from "./config.js";
import { errorHandler } from "./errorHandler.js";

const CORRELATION_ID_HEADER = "x-correlation-id";

export async function buildApp(config: AppConfig = loadAppConfig()) {
  const app = Fastify({
    logger: { level: config.logLevel },
    requestIdHeader: CORRELATION_ID_HEADER,
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.addHook("onSend", async (request, reply) => {
    reply.header(CORRELATION_ID_HEADER, request.id);
  });

  app.addHook("onReady", async () => {
    app.log.info("app composed — ready to accept requests");
  });

  app.addHook("onClose", async () => {
    app.log.info("shutting down — closing resources");
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Workflow Execution Engine API",
        version: "0.1.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/api/docs",
  });

  await app.register(fastifyHelmet);

  // Swagger UI renders via inline <script>/<style>, which Helmet's default CSP
  // blocks. @fastify/swagger-ui registers its own routes internally, so there's
  // no per-route config to pass it — instead, this hook runs after Helmet's own
  // onSend (registered above) and strips the CSP header just for docs requests.
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/api/docs")) {
      reply.removeHeader("content-security-policy");
    }

    return payload;
  });

  return app;
}
