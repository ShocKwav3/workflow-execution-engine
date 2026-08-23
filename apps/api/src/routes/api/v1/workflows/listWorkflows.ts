import type { Resolver } from "../../../../di/types.js";
import { workflowRepositoryToken } from "../../../../db/tokens.js";
import type { TypedFastifyInstance } from "../../../typedFastify.js";
import { ERROR_RESPONSES } from "../../../errorResponses.js";
import { workflowResponseSchema } from "./workflows.schemas.js";
import { toWorkflowResponse } from "./workflows.serializers.js";

export function registerListWorkflows(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "GET",
    url: "/workflows",
    schema: {
      response: { 200: workflowResponseSchema.array(), ...ERROR_RESPONSES },
    },
    handler: async () => {
      const repository = container.resolve(workflowRepositoryToken);
      const workflows = await repository.listWorkflows();

      return workflows.map(toWorkflowResponse);
    },
  });
}
