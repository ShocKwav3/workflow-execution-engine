import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@workflow-engine/core/errors/NotFoundError.js";
import { nodeServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowVersionParamsSchema } from "@/routes/v1/workflowVersions/workflowVersions.schemas.js";
import { createNodeBodySchema, nodeResponseSchema } from "./nodes.schemas.js";
import { toNodeResponse } from "./nodes.serializers.js";

export function registerCreateNode(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows/:workflowId/versions/:version/nodes",
    schema: {
      tags: [TAGS.NODES.name],
      summary: "Add a node to a draft version",
      operationId: "createNode",
      description:
        "Appends a new node to the draft version's node sequence. Fails if the version is not a draft.",
      params: workflowVersionParamsSchema,
      body: createNodeBodySchema,
      response: { 201: nodeResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const service = container.resolve(nodeServiceToken);
      const node = await service.createNode({
        workflowId: request.params.workflowId,
        version: request.params.version,
        name: request.body.name,
        type: request.body.type,
      });

      if (!node) {
        throw new NotFoundError("Workflow version not found");
      }

      reply.status(201).header("location", `/api/v1/nodes/${node.id}`);

      return toNodeResponse(node);
    },
  });
}
