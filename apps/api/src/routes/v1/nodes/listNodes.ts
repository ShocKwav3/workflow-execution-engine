import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@workflow-engine/core/errors/NotFoundError.js";
import { nodeServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowVersionParamsSchema } from "@/routes/v1/workflowVersions/workflowVersions.schemas.js";
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
      const service = container.resolve(nodeServiceToken);
      const nodes = await service.listNodesForVersion({
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
