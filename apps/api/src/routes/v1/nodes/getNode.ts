import type { Resolver } from "@/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@/errors/NotFoundError.js";
import { nodeRepositoryToken } from "@/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { toNodeResponse } from "./nodes.serializers.js";
import { nodeIdParamsSchema, nodeResponseSchema } from "./nodes.schemas.js";

export function registerGetNode(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/nodes/:nodeId",
    schema: {
      params: nodeIdParamsSchema,
      tags: [TAGS.NODES.name],
      summary: "Get a node",
      operationId: "getNode",
      description: "Returns a single node by its globally unique ID.",
      response: { 200: nodeResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeRepositoryToken);
      const node = await repository.getNodeById(request.params.nodeId);

      if (!node) {
        throw new NotFoundError("Node not found");
      }

      return toNodeResponse(node);
    },
  });
}
