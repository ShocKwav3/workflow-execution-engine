// Refinements live outside base schemas: zod's pick/partial/extend throw on a refined object.
export function atLeastOneOf(keys: readonly string[]) {
  return [
    (input: Record<string, unknown>) => keys.some((key) => input[key] !== undefined),
    { message: `At least one of ${keys.join(" or ")} must be provided` },
  ] as const;
}
