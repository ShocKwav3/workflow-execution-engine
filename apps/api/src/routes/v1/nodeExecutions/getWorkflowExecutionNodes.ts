import type { Resolver } from "@/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { nodeExecutionRepositoryToken } from "@/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowExecutionParamsSchema } from "@/routes/v1/workflowExecutions/workflowExecutions.schemas.js";
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
      tags: [TAGS.NODE_EXECUTIONS.name],
      summary: "List node executions for a workflow execution",
      operationId: "getWorkflowExecutionNodes",
      description:
        "Returns one node execution entry per node belonging to the given workflow execution.",
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
