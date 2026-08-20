import type { Resolver } from "../../di/token.js";
import { workflowRepositoryToken } from "../../db/workflowRepository.js";
import type { TypedFastifyInstance } from "../typedFastify.js";
import { ERROR_RESPONSES } from "../errorResponses.js";
import { createWorkflowBodySchema, workflowResponseSchema } from "./workflows.schemas.js";
import { toWorkflowResponse } from "./workflows.serializers.js";

export function registerCreateWorkflow(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "POST",
    url: "/workflows",
    schema: {
      body: createWorkflowBodySchema,
      response: { 201: workflowResponseSchema, ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const workflow = await repository.createWorkflow(request.body);

      reply.status(201);

      return toWorkflowResponse(workflow);
    },
  });
}
