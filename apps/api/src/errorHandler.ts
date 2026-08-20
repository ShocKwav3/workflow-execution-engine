import { z } from "zod";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { AppError } from "./errors/AppError.js";
import { errorTranslators } from "./errors/errorTranslators.js";

// Zod schema doubles as the ErrorEnvelope TS type and a route response schema.
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  for (const translate of errorTranslators) {
    const translated = translate(error);

    if (translated) {
      return translated;
    }
  }

  return new AppError(500, "INTERNAL_ERROR", "Something went wrong", { cause: error });
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

  const appError = toAppError(error);

  if (appError.statusCode >= 500) {
    request.log.error({ err: appError }, "unhandled error");
  }

  reply.status(appError.statusCode).send({
    error: {
      code: appError.code,
      message: appError.message,
      correlationId,
      details: appError.details,
    },
  } satisfies ErrorEnvelope);
}
