import type { Resolver } from "../../../../di/token.js";
import { workflowRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import {
  createWorkflowVersionBodySchema,
  workflowIdParamsSchema,
  workflowVersionResponseSchema,
} from "./workflows.schemas.js";
import { toWorkflowVersionResponse } from "./workflows.serializers.js";

export function registerCreateWorkflowVersion(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows/:id/versions",
    schema: {
      params: workflowIdParamsSchema,
      body: createWorkflowVersionBodySchema,
      response: { 201: workflowVersionResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const version = await repository.createWorkflowVersion({
        workflowId: request.params.id,
        version: request.body.version,
        definition: request.body.definition,
      });

      reply.status(201);

      return toWorkflowVersionResponse(version);
    },
  });
}
