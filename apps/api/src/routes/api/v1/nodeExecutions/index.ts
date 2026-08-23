import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../../../di/types.js";
import { registerGetWorkflowExecutionNodes } from "./getWorkflowExecutionNodes.js";
import { registerGetWorkflowExecutionHistory } from "./getWorkflowExecutionHistory.js";
import { registerGetNodeExecution } from "./getNodeExecution.js";

export async function nodeExecutionRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory((logger, bindings, opts) => {
    bindings.context = "NodeExecutions";

    return logger.child(bindings, opts);
  });

  registerGetWorkflowExecutionNodes(server, container);
  registerGetWorkflowExecutionHistory(server, container);
  registerGetNodeExecution(server, container);
}
