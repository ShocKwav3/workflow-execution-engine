import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../di/token.js";
import { errorEnvelopeSchema } from "../errorHandler.js";
import { workflowExecutionRepositoryToken } from "../db/workflowExecutionRepository.js";
import { stepExecutionRepositoryToken } from "../db/stepExecutionRepository.js";
import type { StepAttemptRow, StepExecutionRow, WorkflowExecutionRow } from "../db/types.js";
import type { StepExecutionHistoryEntry } from "../db/helpers/executionHistoryGrouping.js";
import { replyNotFound, replyWithRepositoryError } from "./httpErrorMapping.js";
import {
  executionHistoryEntryResponseSchema,
  executionIdParamsSchema,
  executionResponseSchema,
  stepExecutionResponseSchema,
} from "./executions.schemas.js";

// Shape every route below can return via replyWithRepositoryError/replyNotFound.
const ERROR_RESPONSES = {
  400: errorEnvelopeSchema,
  409: errorEnvelopeSchema,
  503: errorEnvelopeSchema,
};

function toExecutionResponse(row: WorkflowExecutionRow) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowVersionId: row.workflow_version_id,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

function toStepExecutionResponse(row: StepExecutionRow) {
  return {
    id: row.id,
    workflowExecutionId: row.workflow_execution_id,
    stepName: row.step_name,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toStepAttemptResponse(row: StepAttemptRow) {
  return {
    id: row.id,
    stepExecutionId: row.step_execution_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    error: row.error,
  };
}

function toHistoryEntryResponse(entry: StepExecutionHistoryEntry) {
  return {
    step: toStepExecutionResponse(entry.step),
    attempts: entry.attempts.map(toStepAttemptResponse),
  };
}

export async function executionRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    "/executions/:id",
    {
      schema: {
        params: executionIdParamsSchema,
        response: { 200: executionResponseSchema, 404: errorEnvelopeSchema, ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(workflowExecutionRepositoryToken);

      try {
        const execution = await repository.getWorkflowExecutionById(request.params.id);

        if (!execution) {
          return replyNotFound(request, reply, "Execution not found");
        }

        return toExecutionResponse(execution);
      } catch (error) {
        return replyWithRepositoryError(error, request, reply);
      }
    },
  );

  server.get(
    "/executions/:id/steps",
    {
      schema: {
        params: executionIdParamsSchema,
        response: { 200: stepExecutionResponseSchema.array(), ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(stepExecutionRepositoryToken);

      try {
        const steps = await repository.getStepExecutions(request.params.id);

        return steps.map(toStepExecutionResponse);
      } catch (error) {
        return replyWithRepositoryError(error, request, reply);
      }
    },
  );

  server.get(
    "/executions/:id/history",
    {
      schema: {
        params: executionIdParamsSchema,
        response: { 200: executionHistoryEntryResponseSchema.array(), ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(stepExecutionRepositoryToken);

      try {
        const history = await repository.getWorkflowExecutionHistory(request.params.id);

        return history.map(toHistoryEntryResponse);
      } catch (error) {
        return replyWithRepositoryError(error, request, reply);
      }
    },
  );
}
