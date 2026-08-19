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

  return app;
}
