import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "@workflow-engine/core/di/types.js";
import { createLoggerFactory } from "@/logging/loggerFactory.js";
import { registerCreateWorkflow } from "./createWorkflow.js";
import { registerListWorkflows } from "./listWorkflows.js";
import { registerGetWorkflow } from "./getWorkflow.js";

export async function workflowRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory(createLoggerFactory("Workflows"));

  registerCreateWorkflow(server, container);
  registerListWorkflows(server, container);
  registerGetWorkflow(server, container);
}
