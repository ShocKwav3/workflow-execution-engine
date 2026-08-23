import type { Resolver } from "../../../di/types.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { nodeRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
import { toNodeResponse } from "./nodes.serializers.js";
import { nodeIdParamsSchema, nodeResponseSchema } from "./nodes.schemas.js";

export function registerGetNode(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/nodes/:nodeId",
    schema: {
      params: nodeIdParamsSchema,
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
