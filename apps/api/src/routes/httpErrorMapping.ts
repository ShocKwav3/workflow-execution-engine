import { ZodError } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { DatabaseError } from "../db/errors/index.js";
import type { ErrorEnvelope } from "../errorHandler.js";

interface MappedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function mapDatabaseError(error: DatabaseError): MappedError {
  switch (error.classification) {
    case "CONFLICT":
      return { statusCode: 409, code: "CONFLICT", message: error.message };
    case "INVALID_REFERENCE":
      return { statusCode: 400, code: "INVALID_REFERENCE", message: error.message };
    case "UNAVAILABLE":
      // 5xx — real message stays server-side (logged by the caller), client gets a generic one.
      return {
        statusCode: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable",
      };
  }
}

function mapRepositoryError(error: unknown): MappedError | undefined {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.issues,
    };
  }

  if (error instanceof DatabaseError) {
    return mapDatabaseError(error);
  }

  return undefined;
}

// Called per-route (not a global Fastify handler); rethrows anything unmapped to errorHandler.ts.
export function replyWithRepositoryError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): ErrorEnvelope {
  const mapped = mapRepositoryError(error);

  if (!mapped) {
    throw error;
  }

  if (mapped.statusCode >= 500) {
    request.log.error({ err: error }, "repository operation failed");
  }

  reply.status(mapped.statusCode);

  return {
    error: {
      code: mapped.code,
      message: mapped.message,
      correlationId: request.id,
      details: mapped.details,
    },
  };
}

export function replyNotFound(
  request: FastifyRequest,
  reply: FastifyReply,
  message: string,
): ErrorEnvelope {
  reply.status(404);

  return {
    error: { code: "NOT_FOUND", message, correlationId: request.id },
  };
}
