import { z } from "zod";
import type { Resolver } from "@/di/types.js";
import { TAGS } from "@/routes/v1/config.js";
import { NotFoundError } from "@/errors/NotFoundError.js";
import { workflowRepositoryToken } from "@/db/tokens.js";
import type { TypedFastifyInstance } from "@/routes/typedFastify.js";
import { ERROR_RESPONSES } from "@/routes/errorResponses.js";
import { workflowVersionParamsSchema } from "./workflowVersions.schemas.js";

export function registerDeleteWorkflowVersion(server: TypedFastifyInstance, container: Resolver) {
  server.route({
    method: "DELETE",
    url: "/workflows/:workflowId/versions/:version",
    schema: {
      tags: [TAGS.WORKFLOW_VERSIONS.name],
      summary: "Delete a draft workflow version",
      operationId: "deleteWorkflowVersion",
      description: "Deletes a draft version and its nodes. Published versions cannot be deleted.",
      params: workflowVersionParamsSchema,
      response: { 204: z.null(), ...ERROR_RESPONSES },
    },
    handler: async (request, reply) => {
      const repository = container.resolve(workflowRepositoryToken);
      const deleted = await repository.deleteWorkflowVersion({
        workflowId: request.params.workflowId,
        version: request.params.version,
      });

      if (!deleted) {
        throw new NotFoundError("Workflow version not found");
      }

      return reply.status(204).send(null);
    },
  });
}
