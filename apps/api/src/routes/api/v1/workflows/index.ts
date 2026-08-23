import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../../../di/types.js";
import { registerCreateWorkflow } from "./createWorkflow.js";
import { registerListWorkflows } from "./listWorkflows.js";
import { registerGetWorkflow } from "./getWorkflow.js";

export async function workflowRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory((logger, bindings, opts) => {
    bindings.context = "Workflows";

    return logger.child(bindings, opts);
  });

  registerCreateWorkflow(server, container);
  registerListWorkflows(server, container);
  registerGetWorkflow(server, container);
}
