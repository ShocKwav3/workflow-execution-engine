import type { Resolver } from "../../../../di/types.js";
import { nodeExecutionRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import { workflowExecutionParamsSchema } from "../workflowExecutions/workflowExecutions.schemas.js";
import { nodeExecutionListItemResponseSchema } from "./nodeExecutions.schemas.js";
import { toNodeExecutionListItemResponse } from "./nodeExecutions.serializers.js";

export function registerGetWorkflowExecutionNodes(
  server: TypedFastifyInstance,
  container: Resolver,
) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/executions/:executionId/nodes",
    schema: {
      params: workflowExecutionParamsSchema,
      response: { 200: nodeExecutionListItemResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeExecutionRepositoryToken);
      const nodeExecutions = await repository.getNodeExecutionsForWorkflowExecution({
        workflowId: request.params.workflowId,
        workflowExecutionId: request.params.executionId,
      });

      return nodeExecutions.map(toNodeExecutionListItemResponse);
    },
  });
}
