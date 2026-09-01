import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { workflowRepositoryToken } from "@workflow-engine/core/db/tokens.js";
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
      const repository = container.resolve(workflowRepositoryToken);
      const workflows = await repository.listWorkflows();

      return workflows.map(toWorkflowResponse);
    },
  });
}
