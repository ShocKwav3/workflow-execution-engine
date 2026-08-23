import { z } from "zod";
import type { Resolver } from "../../../../di/types.js";
import { NotFoundError } from "../../../../errors/NotFoundError.js";
import { nodeRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import { nodeIdParamsSchema } from "./nodes.schemas.js";

export function registerDeleteNode(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "DELETE",
    url: "/nodes/:nodeId",
    schema: {
      params: nodeIdParamsSchema,
      response: { 204: z.null(), ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const repository = container.resolve(nodeRepositoryToken);
      const deleted = await repository.deleteNode(request.params.nodeId);

      if (!deleted) {
        throw new NotFoundError("Node not found");
      }

      return reply.status(204).send(null);
    },
  });
}
