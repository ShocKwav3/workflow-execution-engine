import type { Resolver } from "../../di/token.js";
import { stepExecutionRepositoryToken } from "../../db/stepExecutionRepository.js";
import type { TypedFastifyInstance } from "../typedFastify.js";
import { ERROR_RESPONSES } from "../errorResponses.js";
import { workflowExecutionIdParamsSchema, stepExecutionResponseSchema } from "./executions.schemas.js";
import { toStepExecutionResponse } from "./executions.serializers.js";

export function registerGetWorkflowExecutionSteps(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/executions/:id/steps",
    schema: {
      params: workflowExecutionIdParamsSchema,
      response: { 200: stepExecutionResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(stepExecutionRepositoryToken);
      const steps = await repository.getStepExecutions(request.params.id);

      return steps.map(toStepExecutionResponse);
    },
  });
}
