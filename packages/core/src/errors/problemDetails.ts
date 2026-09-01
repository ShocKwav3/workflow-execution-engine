import { z } from "zod";

export const PROBLEM_DETAILS_CONTENT_TYPE = "application/problem+json";

// Registered into v1SchemaRegistry with a format keyword from routes/v1/registry.ts —
// z.int32() alone doesn't emit one; see that file for why.
export const problemDetailsStatusSchema = z.int32();

export const problemDetailsSchema = z.object({
  type: z.string().max(2000),
  title: z.string().max(255),
  status: problemDetailsStatusSchema,
  detail: z.string().max(2000),
  instance: z.string().max(2000),
  code: z.string().max(100),
  errors: z.array(z.unknown()).max(100).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
