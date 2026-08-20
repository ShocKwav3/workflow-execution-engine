import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../di/token.js";
import { errorEnvelopeSchema } from "../errorHandler.js";
import { NotFoundError } from "../errors/NotFoundError.js";
import { workflowRepositoryToken } from "../db/workflowRepository.js";
import { workflowExecutionRepositoryToken } from "../db/workflowExecutionRepository.js";
import type { WorkflowRow, WorkflowVersionRow } from "../db/types.js";
import {
  createExecutionBodySchema,
  createExecutionResponseSchema,
  createWorkflowBodySchema,
  createWorkflowVersionBodySchema,
  workflowIdParamsSchema,
  workflowResponseSchema,
  workflowVersionParamsSchema,
  workflowVersionResponseSchema,
} from "./workflows.schemas.js";

// Shape every route below can return via errorHandler.ts's global dispatch.
const ERROR_RESPONSES = {
  400: errorEnvelopeSchema,
  409: errorEnvelopeSchema,
  503: errorEnvelopeSchema,
};

function toWorkflowResponse(row: WorkflowRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toWorkflowVersionResponse(row: WorkflowVersionRow) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    definition: row.definition,
    createdAt: row.created_at.toISOString(),
  };
}

export async function workflowRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    "/workflows",
    {
      schema: {
        body: createWorkflowBodySchema,
        response: { 201: workflowResponseSchema, ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const workflow = await repository.createWorkflow(request.body);

      reply.status(201);

      return toWorkflowResponse(workflow);
    },
  );

  server.get(
    "/workflows",
    { schema: { response: { 200: workflowResponseSchema.array(), ...ERROR_RESPONSES } } },
    async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const workflows = await repository.listWorkflows();

      return workflows.map(toWorkflowResponse);
    },
  );

  server.get(
    "/workflows/:id",
    {
      schema: {
        params: workflowIdParamsSchema,
        response: { 200: workflowResponseSchema, 404: errorEnvelopeSchema, ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const workflow = await repository.getWorkflowById(request.params.id);

      if (!workflow) {
        throw new NotFoundError("Workflow not found");
      }

      return toWorkflowResponse(workflow);
    },
  );

  server.post(
    "/workflows/:id/versions",
    {
      schema: {
        params: workflowIdParamsSchema,
        body: createWorkflowVersionBodySchema,
        response: { 201: workflowVersionResponseSchema, ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const version = await repository.createWorkflowVersion({
        workflowId: request.params.id,
        version: request.body.version,
        definition: request.body.definition,
      });

      reply.status(201);

      return toWorkflowVersionResponse(version);
    },
  );

  server.get(
    "/workflows/:id/versions/:version",
    {
      schema: {
        params: workflowVersionParamsSchema,
        response: {
          200: workflowVersionResponseSchema,
          404: errorEnvelopeSchema,
          ...ERROR_RESPONSES,
        },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const version = await repository.getWorkflowVersion({
        workflowId: request.params.id,
        version: request.params.version,
      });

      if (!version) {
        throw new NotFoundError("Workflow version not found");
      }

      return toWorkflowVersionResponse(version);
    },
  );

  server.post(
    "/workflows/:id/executions",
    {
      schema: {
        params: workflowIdParamsSchema,
        body: createExecutionBodySchema,
        response: { 201: createExecutionResponseSchema, ...ERROR_RESPONSES },
      },
    },
    async (request, reply) => {
      const repository = container.resolve(workflowExecutionRepositoryToken);
      const idempotencyKeyHeader = request.headers["idempotency-key"];
      const execution = await repository.createWorkflowExecution({
        workflowId: request.params.id,
        workflowVersionId: request.body.workflowVersionId,
        idempotencyKey:
          typeof idempotencyKeyHeader === "string" ? idempotencyKeyHeader : undefined,
      });

      reply.status(201);

      return { executionId: execution.id };
    },
  );
}
