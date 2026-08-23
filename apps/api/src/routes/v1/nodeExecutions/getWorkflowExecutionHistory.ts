import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { nodeExecutionRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
import { workflowExecutionParamsSchema } from "../workflowExecutions/workflowExecutions.schemas.js";
import { nodeExecutionDetailResponseSchema } from "./nodeExecutions.schemas.js";
import { toNodeExecutionDetailResponse } from "./nodeExecutions.serializers.js";

export function registerGetWorkflowExecutionHistory(
  server: TypedFastifyInstance,
  container: Resolver,
) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/executions/:executionId/history",
    schema: {
      tags: [TAGS.NODE_EXECUTIONS.name],
      summary: "Get workflow execution history",
      description:
        "Returns every node execution and attempt for the given workflow execution, in order.",
      params: workflowExecutionParamsSchema,
      response: { 200: nodeExecutionDetailResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeExecutionRepositoryToken);
      const history = await repository.getWorkflowExecutionHistory({
        workflowId: request.params.workflowId,
        workflowExecutionId: request.params.executionId,
      });

      return history.map(toNodeExecutionDetailResponse);
    },
  });
}
