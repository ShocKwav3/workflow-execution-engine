import type { Resolver } from "../../../../di/token.js";
import { errorEnvelopeSchema } from "../../../../errorHandler.js";
import { NotFoundError } from "../../../../errors/NotFoundError.js";
import { nodeExecutionRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import { toNodeExecutionDetailResponse } from "./nodes.serializers.js";
import { nodeExecutionDetailResponseSchema, nodeExecutionParamsSchema } from "./nodes.schemas.js";

export function registerGetNodeExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/nodes/:nodeId/executions/:executionId",
    schema: {
      params: nodeExecutionParamsSchema,
      response: {
        200: nodeExecutionDetailResponseSchema,
        404: errorEnvelopeSchema,
        ...ERROR_RESPONSES,
      },
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
