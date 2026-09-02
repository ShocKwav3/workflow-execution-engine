import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { workflowServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowResponseSchema } from "./workflows.schemas.js";
import { toWorkflowResponse } from "./workflows.serializers.js";

export function registerListWorkflows(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows",
    schema: {
      tags: [TAGS.WORKFLOWS.name],
      summary: "List workflows",
      operationId: "listWorkflows",
      description: "Returns all workflows.",
      response: { 200: workflowResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async () => {
      const service = container.resolve(workflowServiceToken);
      const workflows = await service.listWorkflows();

      return workflows.map(toWorkflowResponse);
    },
  });
}
