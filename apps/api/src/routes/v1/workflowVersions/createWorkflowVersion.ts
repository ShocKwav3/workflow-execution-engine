import type { Resolver } from "@workflow-engine/core/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { workflowServiceToken } from "@workflow-engine/core/services/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowIdParamsSchema } from "@/routes/v1/workflows/workflows.schemas.js";
import {
  createWorkflowVersionBodySchema,
  workflowVersionResponseSchema,
} from "./workflowVersions.schemas.js";
import { toWorkflowVersionResponse } from "./workflowVersions.serializers.js";

export function registerCreateWorkflowVersion(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows/:workflowId/versions",
    schema: {
      tags: [TAGS.WORKFLOW_VERSIONS.name],
      summary: "Create a draft workflow version",
      operationId: "createWorkflowVersion",
      description:
        "Creates a new draft version for the workflow. Nodes can be added, edited, reordered, " +
        "and removed while it remains a draft. A workflow can have at most one draft at a time.",
      params: workflowIdParamsSchema,
      body: createWorkflowVersionBodySchema,
      response: { 201: workflowVersionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const service = container.resolve(workflowServiceToken);
      const version = await service.createWorkflowVersion({
        workflowId: request.params.workflowId,
        version: request.body.version,
      });

      reply.status(201);

      return toWorkflowVersionResponse(version);
    },
  });
}
