import type { FastifyBaseLogger, FastifyInstance, RawServerDefault } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

// The instance type after .withTypeProvider<ZodTypeProvider>() — shared so per-route
// registration functions can be typed against it without re-deriving it in every file.
export type TypedFastifyInstance = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  ZodTypeProvider
>;
