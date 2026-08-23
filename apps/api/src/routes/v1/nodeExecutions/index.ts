import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../../di/types.js";
import { createLoggerFactory } from "../../../logging/contextLogger.js";
import { registerGetWorkflowExecutionNodes } from "./getWorkflowExecutionNodes.js";
import { registerGetWorkflowExecutionHistory } from "./getWorkflowExecutionHistory.js";
import { registerGetNodeExecution } from "./getNodeExecution.js";

export async function nodeExecutionRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory(createLoggerFactory("NodeExecutions"));

  registerGetWorkflowExecutionNodes(server, container);
  registerGetWorkflowExecutionHistory(server, container);
  registerGetNodeExecution(server, container);
}
