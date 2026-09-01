import { z } from "zod";
import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@workflow-engine/core/errors/NotFoundError.js";
import { nodeRepositoryToken } from "@workflow-engine/core/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { nodeIdParamsSchema } from "./nodes.schemas.js";

export function registerDeleteNode(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "DELETE",
    url: "/nodes/:nodeId",
    schema: {
      tags: [TAGS.NODES.name],
      summary: "Delete a node",
      operationId: "deleteNode",
      description:
        "Removes a node from its draft version. Fails if the parent version is already published.",
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
