import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { workflowRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
import { workflowIdParamsSchema } from "../workflows/workflows.schemas.js";
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
      description:
        "Creates a new draft version for the workflow. Nodes can be added, edited, reordered, " +
        "and removed while it remains a draft. A workflow can have at most one draft at a time.",
      params: workflowIdParamsSchema,
      body: createWorkflowVersionBodySchema,
      response: { 201: workflowVersionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const version = await repository.createWorkflowVersion({
        workflowId: request.params.workflowId,
        version: request.body.version,
      });

      reply.status(201);

      return toWorkflowVersionResponse(version);
    },
  });
}
