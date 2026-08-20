import type { Resolver } from "../../di/token.js";
import { workflowExecutionRepositoryToken } from "../../db/tokens.js";
import type { TypedFastifyInstance } from "../typedFastify.js";
import { ERROR_RESPONSES } from "../errorResponses.js";
import {
  createWorkflowExecutionBodySchema,
  createWorkflowExecutionResponseSchema,
  workflowIdParamsSchema,
} from "./workflows.schemas.js";

export function registerCreateWorkflowExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows/:id/executions",
    schema: {
      params: workflowIdParamsSchema,
      body: createWorkflowExecutionBodySchema,
      response: { 201: createWorkflowExecutionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
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
  });
}
