import type { Resolver } from "@/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@/errors/NotFoundError.js";
import { workflowRepositoryToken } from "@/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import {
  workflowVersionParamsSchema,
  workflowVersionResponseSchema,
} from "./workflowVersions.schemas.js";
import { toWorkflowVersionResponse } from "./workflowVersions.serializers.js";

export function registerPublishWorkflowVersion(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows/:workflowId/versions/:version/publish",
    schema: {
      tags: [TAGS.WORKFLOW_VERSIONS.name],
      summary: "Publish a workflow version",
      operationId: "publishWorkflowVersion",
      description:
        "Freezes the version's node set permanently and makes it executable. Requires at least " +
        "one node. A published version can never be edited or deleted again.",
      params: workflowVersionParamsSchema,
      response: { 200: workflowVersionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowRepositoryToken);
      const published = await repository.publishWorkflowVersion({
        workflowId: request.params.workflowId,
        version: request.params.version,
      });

      if (!published) {
        throw new NotFoundError("Workflow version not found");
      }

      return toWorkflowVersionResponse(published);
    },
  });
}
