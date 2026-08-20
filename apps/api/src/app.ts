import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifyHelmet from "@fastify/helmet";
import { loadAppConfig, type AppConfig } from "./config.js";
import { PINO_PRETTY_OPTIONS } from "./config/pinoPretty.js";
import { errorHandler } from "./errorHandler.js";
import { createContextLogger } from "./logging/contextLogger.js";

const CORRELATION_ID_HEADER = "x-correlation-id";

export async function buildApp(config: AppConfig = loadAppConfig()) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(config.logPretty
        ? { transport: { target: "pino-pretty", options: PINO_PRETTY_OPTIONS } }
        : {}),
    },
    requestIdHeader: CORRELATION_ID_HEADER,
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.addHook("onSend", async (request, reply) => {
    reply.header(CORRELATION_ID_HEADER, request.id);
  });

  const lifecycleLogger = createContextLogger(app.log, "Lifecycle");

  app.addHook("onReady", async () => {
    lifecycleLogger.info("app composed — ready to accept requests");
  });

  app.addHook("onClose", async () => {
    lifecycleLogger.info("shutting down — closing resources");
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  await app.register(fastifyHelmet);

  return app;
}
