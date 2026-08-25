import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { nodeRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
import { nodeIdParamsSchema, nodeResponseSchema, updateNodeBodySchema } from "./nodes.schemas.js";
import { toNodeResponse } from "./nodes.serializers.js";

export function registerUpdateNode(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "PATCH",
    url: "/nodes/:nodeId",
    schema: {
      params: nodeIdParamsSchema,
      tags: [TAGS.NODES.name],
      summary: "Update a node",
      operationId: "updateNode",
      description: "Updates a node's fields. Fails if the parent version is already published.",
      body: updateNodeBodySchema,
      response: { 200: nodeResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeRepositoryToken);
      const node = await repository.updateNode(request.params.nodeId, request.body);

      if (!node) {
        throw new NotFoundError("Node not found");
      }

      return toNodeResponse(node);
    },
  });
}
