import type { Resolver } from "../../../di/types.js";
import { TAGS } from "../config.js";
import { workflowRepositoryToken } from "../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../typedFastify.js";
import { ERROR_RESPONSES } from "../../errorResponses.js";
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
