import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../../../di/token.js";
import { registerCreateWorkflow } from "./createWorkflow.js";
import { registerListWorkflows } from "./listWorkflows.js";
import { registerGetWorkflow } from "./getWorkflow.js";
import { registerCreateWorkflowVersion } from "./createWorkflowVersion.js";
import { registerGetWorkflowVersion } from "./getWorkflowVersion.js";
import { registerCreateWorkflowExecution } from "./createWorkflowExecution.js";
import { registerGetWorkflowExecution } from "./getWorkflowExecution.js";
import { registerGetWorkflowExecutionNodes } from "./getWorkflowExecutionNodes.js";
import { registerGetWorkflowExecutionHistory } from "./getWorkflowExecutionHistory.js";

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
  registerCreateWorkflowVersion(server, container);
  registerGetWorkflowVersion(server, container);
  registerCreateWorkflowExecution(server, container);
  registerGetWorkflowExecution(server, container);
  registerGetWorkflowExecutionNodes(server, container);
  registerGetWorkflowExecutionHistory(server, container);
}
