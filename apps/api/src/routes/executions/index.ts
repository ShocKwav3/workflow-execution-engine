import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../di/token.js";
import { registerGetWorkflowExecution } from "./getWorkflowExecution.js";
import { registerGetWorkflowExecutionSteps } from "./getWorkflowExecutionSteps.js";
import { registerGetWorkflowExecutionHistory } from "./getWorkflowExecutionHistory.js";

export async function executionRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  registerGetWorkflowExecution(server, container);
  registerGetWorkflowExecutionSteps(server, container);
  registerGetWorkflowExecutionHistory(server, container);
}
