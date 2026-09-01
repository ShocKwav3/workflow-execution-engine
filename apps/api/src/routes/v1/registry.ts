import { z } from "zod";
import {
  problemDetailsSchema,
  problemDetailsStatusSchema,
} from "@workflow-engine/core/errors/problemDetails.js";

// Matches fastify-type-provider-zod's unexported SchemaRegistryMeta structurally —
// createJsonSchemaTransformObject requires a registry typed to it.
type SchemaRegistryMeta = { id?: string; [key: string]: unknown };

// Own instance, not z.globalRegistry — keeps a future v2's schema ids
// (e.g. "Workflow") from silently overwriting v1's in the shared registry.
export const v1SchemaRegistry = z.registry<SchemaRegistryMeta>();

// problemDetailsSchema is version-agnostic (src/errors/), so it's registered
// here rather than at its own definition — each version registers it into
// its own document independently.
v1SchemaRegistry.add(problemDetailsSchema, { id: "ProblemDetails" });

// zod's JSON Schema generator never emits a `format` keyword for numbers — only for
// strings (confirmed by reading json-schema-processors.js: the number processor reads
// z.int32()'s internal format to decide integer vs number, but never writes it back out).
// Registering it directly is the only way to get owasp:api4:2023-integer-format's required
// `format: int32` into the generated document. Call on every z.int32()/z.int64() field used
// in a route schema — chain everything else first (.positive(), .describe(), ...), since
// zod schema methods return a new instance each time, so registering has to happen last.
export function withIntFormat<T extends z.ZodType>(schema: T, format: "int32" | "int64"): T {
  v1SchemaRegistry.add(schema, { format });

  return schema;
}

withIntFormat(problemDetailsStatusSchema, "int32");
