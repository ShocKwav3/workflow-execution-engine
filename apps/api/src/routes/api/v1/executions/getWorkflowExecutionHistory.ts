import type { Resolver } from "../../../../di/token.js";
import { stepExecutionRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import {
  workflowExecutionHistoryEntryResponseSchema,
  workflowExecutionIdParamsSchema,
} from "./executions.schemas.js";
import { toWorkflowExecutionHistoryEntryResponse } from "./executions.serializers.js";

export function registerGetWorkflowExecutionHistory(
  server: TypedFastifyInstance,
  container: Resolver,
) {
  server.route({
    method: "GET",
    url: "/executions/:id/history",
    schema: {
      params: workflowExecutionIdParamsSchema,
      response: { 200: workflowExecutionHistoryEntryResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const repository = container.resolve(stepExecutionRepositoryToken);
      const history = await repository.getWorkflowExecutionHistory(request.params.id);

      return history.map(toWorkflowExecutionHistoryEntryResponse);
    },
  });
}
