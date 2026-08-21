import type { Resolver } from "../../../../di/token.js";
import { nodeExecutionRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import {
  nodeExecutionListItemResponseSchema,
  workflowExecutionParamsSchema,
} from "./workflows.schemas.js";
import { toNodeExecutionListItemResponse } from "./workflows.serializers.js";

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
      const nodeExecutions = await repository.getNodeExecutionsForWorkflowExecution(
        request.params.executionId,
      );

      return nodeExecutions.map(toNodeExecutionListItemResponse);
    },
  });
}
