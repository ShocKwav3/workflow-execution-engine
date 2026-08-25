import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { nodeRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
import { workflowVersionParamsSchema } from "../workflowVersions/workflowVersions.schemas.js";
import { nodeResponseSchema, reorderNodesBodySchema } from "./nodes.schemas.js";
import { toNodeResponse } from "./nodes.serializers.js";

export function registerReorderNodes(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "PUT",
    url: "/workflows/:workflowId/versions/:version/nodes",
    schema: {
      params: workflowVersionParamsSchema,
      tags: [TAGS.NODES.name],
      summary: "Reorder nodes in a draft version",
      operationId: "reorderNodes",
      description:
        "Replaces the execution order of all nodes in the draft version. Fails if the version " +
        "is not a draft or the given node ID set doesn't exactly match the version's nodes.",
      body: reorderNodesBodySchema,
      response: { 200: nodeResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(nodeRepositoryToken);
      const nodes = await repository.reorderNodes({
        workflowId: request.params.workflowId,
        version: request.params.version,
        nodeIds: request.body.nodeIds,
      });

      if (!nodes) {
        throw new NotFoundError("Workflow version not found");
      }

      return nodes.map(toNodeResponse);
    },
  });
}
