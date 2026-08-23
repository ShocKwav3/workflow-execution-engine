import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../../di/types.js";
import { createLoggerFactory } from "../../../logging/contextLogger.js";
import { registerCreateWorkflowExecution } from "./createWorkflowExecution.js";
import { registerGetWorkflowExecution } from "./getWorkflowExecution.js";

export async function workflowExecutionRoutes(
  app: FastifyInstance,
  options: { container: Resolver },
) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory(createLoggerFactory("WorkflowExecutions"));

  registerCreateWorkflowExecution(server, container);
  registerGetWorkflowExecution(server, container);
}
