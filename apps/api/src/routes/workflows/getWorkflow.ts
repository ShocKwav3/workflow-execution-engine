import type { Resolver } from "../../di/token.js";
import { errorEnvelopeSchema } from "../../errorHandler.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { workflowRepositoryToken } from "../../db/workflowRepository.js";
import type { TypedFastifyInstance } from "../typedFastify.js";
import { ERROR_RESPONSES } from "../errorResponses.js";
import { workflowIdParamsSchema, workflowResponseSchema } from "./workflows.schemas.js";
import { toWorkflowResponse } from "./workflows.serializers.js";

export function registerGetWorkflow(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:id",
    schema: {
      params: workflowIdParamsSchema,
      response: { 200: workflowResponseSchema, 404: errorEnvelopeSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowRepositoryToken);
      const workflow = await repository.getWorkflowById(request.params.id);

      if (!workflow) {
        throw new NotFoundError("Workflow not found");
      }

      return toWorkflowResponse(workflow);
    },
  });
}
