import type { Resolver } from "../../../../di/token.js";
import { nodeExecutionRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import { nodeExecutionDetailResponseSchema } from "../nodes/nodes.schemas.js";
import { toNodeExecutionDetailResponse } from "../nodes/nodes.serializers.js";
import { workflowExecutionParamsSchema } from "./workflows.schemas.js";

export function registerGetWorkflowExecutionHistory(
  server: TypedFastifyInstance,
  container: Resolver,
) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/executions/:executionId/history",
    schema: {
      params: workflowExecutionParamsSchema,
      response: { 200: nodeExecutionDetailResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeExecutionRepositoryToken);
      const history = await repository.getWorkflowExecutionHistory(request.params.executionId);

      return history.map(toNodeExecutionDetailResponse);
    },
  });
}
