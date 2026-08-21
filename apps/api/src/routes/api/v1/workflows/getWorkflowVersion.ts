import type { Resolver } from "../../../../di/token.js";
import { errorEnvelopeSchema } from "../../../../errorHandler.js";
import { NotFoundError } from "../../../../errors/NotFoundError.js";
import { workflowRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import { workflowVersionParamsSchema, workflowVersionResponseSchema } from "./workflows.schemas.js";
import { toWorkflowVersionResponse } from "./workflows.serializers.js";

export function registerGetWorkflowVersion(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/versions/:version",
    schema: {
      params: workflowVersionParamsSchema,
      response: {
        200: workflowVersionResponseSchema,
        404: errorEnvelopeSchema,
        ...ERROR_RESPONSES,
      },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowRepositoryToken);
      const versionWithNodes = await repository.getWorkflowVersion({
        workflowId: request.params.workflowId,
        version: request.params.version,
      });

      if (!versionWithNodes) {
        throw new NotFoundError("Workflow version not found");
      }

      return toWorkflowVersionResponse(versionWithNodes);
    },
  });
}
