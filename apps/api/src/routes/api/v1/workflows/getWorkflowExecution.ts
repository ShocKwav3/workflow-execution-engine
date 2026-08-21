import type { Resolver } from "../../../../di/token.js";
import { errorEnvelopeSchema } from "../../../../errorHandler.js";
import { NotFoundError } from "../../../../errors/NotFoundError.js";
import { workflowExecutionRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import {
  workflowExecutionParamsSchema,
  workflowExecutionResponseSchema,
} from "./workflows.schemas.js";
import { toWorkflowExecutionResponse } from "./workflows.serializers.js";

export function registerGetWorkflowExecution(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId/executions/:executionId",
    schema: {
      params: workflowExecutionParamsSchema,
      response: {
        200: workflowExecutionResponseSchema,
        404: errorEnvelopeSchema,
        ...ERROR_RESPONSES,
      },
    },
    handler: async (request) => {
      const repository = container.resolve(workflowExecutionRepositoryToken);
      const execution = await repository.getWorkflowExecutionById(request.params.executionId);

      if (!execution) {
        throw new NotFoundError("Execution not found");
      }

      return toWorkflowExecutionResponse(execution);
    },
  });
}
