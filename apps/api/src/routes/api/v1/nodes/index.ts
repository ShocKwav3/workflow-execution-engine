import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Resolver } from "../../../../di/token.js";
import { registerGetNode } from "./getNode.js";
import { registerGetNodeExecution } from "./getNodeExecution.js";

export async function nodeRoutes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.setChildLoggerFactory((logger, bindings, opts) => {
    bindings.context = "Nodes";

    return logger.child(bindings, opts);
  });

  registerGetNode(server, container);
  registerGetNodeExecution(server, container);
}
