import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { workflowRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
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
      description: "Returns a single workflow version by workflow ID and version number.",
      response: { 200: workflowVersionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowRepositoryToken);
      const version = await repository.getWorkflowVersion({
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
