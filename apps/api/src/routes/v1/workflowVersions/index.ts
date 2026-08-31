import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "@/di/types.js";
import { createLoggerFactory } from "@/logging/contextLogger.js";
import { registerCreateWorkflowVersion } from "./createWorkflowVersion.js";
import { registerGetWorkflowVersion } from "./getWorkflowVersion.js";
import { registerPublishWorkflowVersion } from "./publishWorkflowVersion.js";
import { registerDeleteWorkflowVersion } from "./deleteWorkflowVersion.js";

export async function workflowVersionRoutes(
  app: FastifyInstance,
  options: { container: Resolver },
) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory(createLoggerFactory("WorkflowVersions"));

  registerCreateWorkflowVersion(server, container);
  registerGetWorkflowVersion(server, container);
  registerPublishWorkflowVersion(server, container);
  registerDeleteWorkflowVersion(server, container);
}
