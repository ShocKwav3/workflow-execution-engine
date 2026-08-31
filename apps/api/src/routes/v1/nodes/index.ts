import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "@/di/types.js";
import { createLoggerFactory } from "@/logging/contextLogger.js";
import { registerCreateNode } from "./createNode.js";
import { registerListNodes } from "./listNodes.js";
import { registerReorderNodes } from "./reorderNodes.js";
import { registerGetNode } from "./getNode.js";
import { registerUpdateNode } from "./updateNode.js";
import { registerDeleteNode } from "./deleteNode.js";

export async function nodeRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory(createLoggerFactory("Nodes"));

  registerCreateNode(server, container);
  registerListNodes(server, container);
  registerReorderNodes(server, container);
  registerGetNode(server, container);
  registerUpdateNode(server, container);
  registerDeleteNode(server, container);
}
