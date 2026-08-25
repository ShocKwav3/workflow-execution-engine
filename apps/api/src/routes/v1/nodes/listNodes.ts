import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { nodeRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
import { workflowVersionParamsSchema } from "../workflowVersions/workflowVersions.schemas.js";
import { nodeResponseSchema } from "./nodes.schemas.js";
import { toNodeResponse } from "./nodes.serializers.js";

export function registerListNodes(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/versions/:version/nodes",
    schema: {
      params: workflowVersionParamsSchema,
      tags: [TAGS.NODES.name],
      summary: "List nodes in a workflow version",
      operationId: "listNodes",
      description: "Returns all nodes belonging to the given workflow version, in execution order.",
      response: { 200: nodeResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeRepositoryToken);
      const nodes = await repository.listNodesForVersion({
        workflowId: request.params.workflowId,
        version: request.params.version,
      });

      if (!nodes) {
        throw new NotFoundError("Workflow version not found");
      }

      return nodes.map(toNodeResponse);
    },
  });
}
