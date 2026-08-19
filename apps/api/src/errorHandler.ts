import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: unknown;
  };
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const correlationId = request.id;

  if (hasZodFastifySchemaValidationErrors(error)) {
    reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        correlationId,
        details: error.validation,
      },
    } satisfies ErrorEnvelope);

    return;
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error }, "response serialization failed");

    reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal Server Error",
        correlationId,
      },
    } satisfies ErrorEnvelope);

    return;
  }

  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    request.log.error({ err: error }, "unhandled error");
  }

  reply.status(statusCode).send({
    error: {
      code: error.code ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
      message: statusCode >= 500 ? "Internal Server Error" : error.message,
      correlationId,
    },
  } satisfies ErrorEnvelope);
}
