import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifyHelmet from "@fastify/helmet";
import { loadAppConfig, type AppConfig } from "./config.js";
import { createPinoOptions } from "@workflow-engine/core/logging/logger.js";
import { errorHandler } from "./handlers/errorHandler.js";
import { registerNotFoundHandler } from "./handlers/notFoundHandler.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import { correlationIdSchema } from "@workflow-engine/core/schemas/correlation.schemas.js";

const CORRELATION_ID_HEADER = "x-correlation-id";

export async function buildApp(config: AppConfig = loadAppConfig()) {
  const app = Fastify({
    logger: createPinoOptions(config.log),
    genReqId: (req) => {
      const incoming = correlationIdSchema.safeParse(req.headers[CORRELATION_ID_HEADER]);

      return incoming.success ? incoming.data : randomUUID();
    },
    // Router errors (bad URL, over-long path parameter) never reach setErrorHandler
    frameworkErrors: errorHandler,
    // Drop the keys instead of a 400: unknown keys are ignored everywhere else too
    onProtoPoisoning: "remove",
    onConstructorPoisoning: "remove",
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
  registerNotFoundHandler(app);

  await app.register(fastifyHelmet);

  return app;
}
