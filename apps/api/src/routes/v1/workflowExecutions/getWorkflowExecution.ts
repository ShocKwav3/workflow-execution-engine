import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { workflowExecutionRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
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
      description: "Returns the current state of a single workflow execution.",
      params: workflowExecutionParamsSchema,
      response: { 200: workflowExecutionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowExecutionRepositoryToken);
      const execution = await repository.getWorkflowExecutionById(request.params.executionId);

      if (!execution || execution.workflow_id !== request.params.workflowId) {
        throw new NotFoundError("Workflow execution not found");
      }

      return toWorkflowExecutionResponse(execution);
    },
  });
}
