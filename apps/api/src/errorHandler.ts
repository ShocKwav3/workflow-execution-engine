import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { AppError } from "@workflow-engine/core/errors/AppError.js";
import { errorTranslators } from "@workflow-engine/core/errors/errorTranslators.js";
import {
  PROBLEM_DETAILS_CONTENT_TYPE,
  type ProblemDetails,
} from "@workflow-engine/core/errors/problemDetails.js";

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

  return new AppError(500, "INTERNAL_ERROR", "Internal Server Error", "Something went wrong", {
    cause: error,
  });
}

function send(reply: FastifyReply, request: FastifyRequest, appError: AppError): void {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: appError.title,
    status: appError.statusCode,
    detail: appError.detail,
    instance: request.url,
    code: appError.code,
    ...(appError.errors === undefined ? {} : { errors: appError.errors as unknown[] }),
  };

  reply.status(appError.statusCode).type(PROBLEM_DETAILS_CONTENT_TYPE).send(problem);
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (hasZodFastifySchemaValidationErrors(error)) {
    send(
      reply,
      request,
      new AppError(400, "VALIDATION_ERROR", "Bad Request", "Request validation failed", {
        errors: error.validation,
      }),
    );

    return;
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error }, "response serialization failed");
    send(
      reply,
      request,
      new AppError(500, "INTERNAL_ERROR", "Internal Server Error", "Something went wrong", {
        cause: error,
      }),
    );

    return;
  }

  const appError = toAppError(error);

  if (appError.statusCode >= 500) {
    // appError.detail is sanitized for the client — log the real cause instead.
    request.log.error({ err: appError.cause ?? appError, ...appError.context }, "unhandled error");
  } else {
    request.log.warn({ err: appError, ...appError.context }, "request failed");
  }

  send(reply, request, appError);
}
