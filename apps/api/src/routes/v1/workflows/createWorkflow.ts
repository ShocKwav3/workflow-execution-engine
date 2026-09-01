import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { workflowServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { createWorkflowBodySchema, workflowResponseSchema } from "./workflows.schemas.js";
import { toWorkflowResponse } from "./workflows.serializers.js";

export function registerCreateWorkflow(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows",
    schema: {
      tags: [TAGS.WORKFLOWS.name],
      summary: "Create a workflow",
      operationId: "createWorkflow",
      description:
        "Creates a new workflow definition. Does not create a version or execute anything.",
      body: createWorkflowBodySchema,
      response: { 201: workflowResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const service = container.resolve(workflowServiceToken);
      const workflow = await service.createWorkflow(request.body);

      reply.status(201);

      return toWorkflowResponse(workflow);
    },
  });
}
