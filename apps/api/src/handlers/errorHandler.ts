import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { AppError } from "@workflow-engine/core/errors/AppError.js";
import { sendRouteNotFound } from "./notFoundHandler.js";
import { errorTranslators } from "@workflow-engine/core/errors/errorTranslators.js";
import {
  PROBLEM_DETAILS_CONTENT_TYPE,
  PROBLEM_DETAILS_MAX_DETAIL_LENGTH,
  PROBLEM_DETAILS_MAX_ERRORS,
  PROBLEM_DETAILS_MAX_INSTANCE_LENGTH,
  type ProblemDetails,
} from "@workflow-engine/core/errors/problemDetails.js";

function isFastifyClientError(
  error: unknown,
): error is { code: string; statusCode: number; message: string } {
  const { code, statusCode } = error as Partial<FastifyError>;

  return (
    typeof code === "string" &&
    code.startsWith("FST_ERR_") &&
    typeof statusCode === "number" &&
    statusCode >= 400 &&
    statusCode < 500
  );
}

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

  // A custom error handler must apply the 4xx status of Fastify's own client errors itself
  if (isFastifyClientError(error)) {
    return new AppError(
      error.statusCode,
      error.code,
      STATUS_CODES[error.statusCode] ?? "Bad Request",
      error.message,
    );
  }

  return new AppError(500, "INTERNAL_ERROR", "Internal Server Error", "Something went wrong", {
    cause: error,
  });
}

// Capped to the response schema's limits; an oversized error body would fail serialization
export function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  appError: AppError,
): void {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: appError.title,
    status: appError.statusCode,
    detail: appError.detail.slice(0, PROBLEM_DETAILS_MAX_DETAIL_LENGTH),
    instance: request.url.slice(0, PROBLEM_DETAILS_MAX_INSTANCE_LENGTH),
    code: appError.code,
    ...(appError.errors === undefined
      ? {}
      : { errors: (appError.errors as unknown[]).slice(0, PROBLEM_DETAILS_MAX_ERRORS) }),
  };

  reply.status(appError.statusCode).type(PROBLEM_DETAILS_CONTENT_TYPE).send(problem);
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Without a route, the missing route is the answer, not a header or body error before routing
  if (request.is404) {
    sendRouteNotFound(request, reply);

    return;
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    sendProblem(
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
    sendProblem(
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

  sendProblem(reply, request, appError);
}
