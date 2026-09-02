import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@workflow-engine/core/errors/NotFoundError.js";
import { workflowServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import {
  workflowVersionParamsSchema,
  workflowVersionResponseSchema,
} from "./workflowVersions.schemas.js";
import { toWorkflowVersionResponse } from "./workflowVersions.serializers.js";

export function registerGetWorkflowVersion(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/versions/:version",
    schema: {
      params: workflowVersionParamsSchema,
      tags: [TAGS.WORKFLOW_VERSIONS.name],
      summary: "Get a workflow version",
      operationId: "getWorkflowVersion",
      description: "Returns a single workflow version by workflow ID and version number.",
      response: { 200: workflowVersionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const service = container.resolve(workflowServiceToken);
      const version = await service.getWorkflowVersion({
        workflowId: request.params.workflowId,
        version: request.params.version,
      });

      if (!version) {
        throw new NotFoundError("Workflow version not found");
      }

      return toWorkflowVersionResponse(version);
    },
  });
}
