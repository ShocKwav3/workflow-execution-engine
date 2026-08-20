import type { Resolver } from "../../di/token.js";
import { errorEnvelopeSchema } from "../../errorHandler.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { workflowExecutionRepositoryToken } from "../../db/workflowExecutionRepository.js";
import type { TypedFastifyInstance } from "../typedFastify.js";
import { ERROR_RESPONSES } from "../errorResponses.js";
import { workflowExecutionIdParamsSchema, workflowExecutionResponseSchema } from "./executions.schemas.js";
import { toWorkflowExecutionResponse } from "./executions.serializers.js";

export function registerGetWorkflowExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/executions/:id",
    schema: {
      params: workflowExecutionIdParamsSchema,
      response: { 200: workflowExecutionResponseSchema, 404: errorEnvelopeSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowExecutionRepositoryToken);
      const execution = await repository.getWorkflowExecutionById(request.params.id);

      if (!execution) {
        throw new NotFoundError("Execution not found");
      }

      return toWorkflowExecutionResponse(execution);
    },
  });
}
