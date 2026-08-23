import { z } from "zod";

export const PROBLEM_DETAILS_CONTENT_TYPE = "application/problem+json";

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  code: z.string(),
  errors: z.array(z.unknown()).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
