import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
} from "fastify-type-provider-zod";
import { v1SchemaRegistry } from "./registry.js";
import type { Resolver } from "@/di/types.js";
import { TAGS, V1_PREFIX } from "./config.js";
import { workflowRoutes } from "./workflows/index.js";
import { workflowVersionRoutes } from "./workflowVersions/index.js";
import { nodeRoutes } from "./nodes/index.js";
import { workflowExecutionRoutes } from "./workflowExecutions/index.js";
import { nodeExecutionRoutes } from "./nodeExecutions/index.js";

// A variable (not an inline literal) so TypeScript's excess-property check doesn't reject
// "x-internal" — OpenAPIV3.ServerObject has no index signature for extension keywords, but
// this OWASP-required field is still valid OpenAPI (any "x-*" key is a spec-sanctioned
// extension point).
const openApiServers = [
  { url: "http://localhost:3000", description: "Local development", "x-internal": true },
];

export async function v1Routes(app: FastifyInstance, options: { container: Resolver }) {
  const { container } = options;

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Workflow Execution Engine API",
        version: "1.0.0",
        description:
          "Workflow definitions, versions, nodes, and their executions. See milestones.md " +
          "for the full system this API is the first slice of.",
      },
      servers: openApiServers,
      tags: Object.values(TAGS),
    },
    transform: createJsonSchemaTransform({ schemaRegistry: v1SchemaRegistry }),
    transformObject: createJsonSchemaTransformObject({ schemaRegistry: v1SchemaRegistry }),
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    // Without this, swagger-ui's generated HTML links assets at "/docs/static/..."
    // instead of "/api/v1/docs/static/...", since it has no way to see the outer
    // prefix this plugin is nested under — @fastify/swagger-ui's documented escape
    // hatch for exactly this ("server behind path based routing").
    indexPrefix: V1_PREFIX,
  });

  // Helmet's default CSP blocks Swagger UI's inline scripts — stripped for this version's docs only.
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.includes("/docs")) {
      reply.removeHeader("content-security-policy");
    }

    return payload;
  });

  await app.register(workflowRoutes, { container });
  await app.register(workflowVersionRoutes, { container });
  await app.register(nodeRoutes, { container });
  await app.register(workflowExecutionRoutes, { container });
  await app.register(nodeExecutionRoutes, { container });
}
