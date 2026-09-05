import type { ZodType, output } from "zod";
import { InternalValidationError } from "./InternalValidationError.js";

// safeParse, not parse: a ZodError reaching translateZodError would report our bug as 400.
export function parseInternal<T extends ZodType>(
  schema: T,
  input: unknown,
  context: string,
): output<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new InternalValidationError(context, result.error);
  }

  return result.data;
}
