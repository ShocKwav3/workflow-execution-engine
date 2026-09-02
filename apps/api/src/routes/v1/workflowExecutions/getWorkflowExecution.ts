import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@workflow-engine/core/errors/NotFoundError.js";
import { workflowExecutionServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import {
  workflowExecutionParamsSchema,
  workflowExecutionResponseSchema,
} from "./workflowExecutions.schemas.js";
import { toWorkflowExecutionResponse } from "./workflowExecutions.serializers.js";

export function registerGetWorkflowExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/executions/:executionId",
    schema: {
      tags: [TAGS.WORKFLOW_EXECUTIONS.name],
      summary: "Get a workflow execution",
      operationId: "getWorkflowExecution",
      description: "Returns the current state of a single workflow execution.",
      params: workflowExecutionParamsSchema,
      response: { 200: workflowExecutionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const service = container.resolve(workflowExecutionServiceToken);
      const execution = await service.getWorkflowExecutionById(request.params.executionId);

      if (!execution || execution.workflow_id !== request.params.workflowId) {
        throw new NotFoundError("Workflow execution not found");
      }

      return toWorkflowExecutionResponse(execution);
    },
  });
}
