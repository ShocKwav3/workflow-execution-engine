import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@workflow-engine/core/errors/NotFoundError.js";
import { workflowServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowIdParamsSchema, workflowResponseSchema } from "./workflows.schemas.js";
import { toWorkflowResponse } from "./workflows.serializers.js";

export function registerGetWorkflow(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows/:workflowId",
    schema: {
      tags: [TAGS.WORKFLOWS.name],
      summary: "Get a workflow",
      operationId: "getWorkflow",
      description: "Returns a single workflow by ID.",
      params: workflowIdParamsSchema,
      response: { 200: workflowResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request) => {
      const service = container.resolve(workflowServiceToken);
      const workflow = await service.getWorkflowById(request.params.workflowId);

      if (!workflow) {
        throw new NotFoundError("Workflow not found");
      }

      return toWorkflowResponse(workflow);
    },
  });
}
