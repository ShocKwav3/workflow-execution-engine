import type { Resolver } from "@/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@/errors/NotFoundError.js";
import { nodeExecutionRepositoryToken } from "@/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import {
  nodeExecutionDetailResponseSchema,
  nodeExecutionParamsSchema,
} from "./nodeExecutions.schemas.js";
import { toNodeExecutionDetailResponse } from "./nodeExecutions.serializers.js";

export function registerGetNodeExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/nodes/:nodeId/executions/:executionId",
    schema: {
      tags: [TAGS.NODE_EXECUTIONS.name],
      summary: "Get a node execution",
      operationId: "getNodeExecution",
      description:
        "Returns the node-level execution record for a specific node within a specific workflow execution.",
      params: nodeExecutionParamsSchema,
      response: { 200: nodeExecutionDetailResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeExecutionRepositoryToken);
      const entry = await repository.getNodeExecutionByNodeAndExecution({
        nodeId: request.params.nodeId,
        workflowExecutionId: request.params.executionId,
      });

      if (!entry) {
        throw new NotFoundError("Node execution not found");
      }

      return toNodeExecutionDetailResponse(entry);
    },
  });
}
