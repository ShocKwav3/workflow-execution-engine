import type { Resolver } from "../../../di/types.js";
import { NotFoundError } from "../../../errors/NotFoundError.js";
import { workflowRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
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
