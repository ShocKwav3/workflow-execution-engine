import type { Resolver } from "@/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { workflowExecutionRepositoryToken } from "@/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowIdParamsSchema } from "@/routes/v1/workflows/workflows.schemas.js";
import {
  createWorkflowExecutionBodySchema,
  createWorkflowExecutionResponseSchema,
} from "./workflowExecutions.schemas.js";

export function registerCreateWorkflowExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows/:workflowId/executions",
    schema: {
      tags: [TAGS.WORKFLOW_EXECUTIONS.name],
      summary: "Start a workflow execution",
      operationId: "createWorkflowExecution",
      description:
        "Starts one execution of a published workflow version and returns immediately with an " +
        "execution ID — the run itself happens asynchronously. Supports the Idempotency-Key " +
        "header to avoid creating duplicate executions on retry.",
      params: workflowIdParamsSchema,
      body: createWorkflowExecutionBodySchema,
      response: { 201: createWorkflowExecutionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const repository = container.resolve(workflowExecutionRepositoryToken);
      const idempotencyKeyHeader = request.headers["idempotency-key"];
      const execution = await repository.createWorkflowExecution({
        workflowId: request.params.workflowId,
        workflowVersionId: request.body.workflowVersionId,
        idempotencyKey: typeof idempotencyKeyHeader === "string" ? idempotencyKeyHeader : undefined,
      });

      reply.status(201);

      return { executionId: execution.id };
    },
  });
}
