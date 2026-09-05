import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { InternalValidationError } from "@/errors/InternalValidationError.js";
import { parseInternal } from "@/errors/parseInternal.js";

const schema = z.object({ id: z.uuid() });

describe("parseInternal", () => {
  it("returns the parsed output on valid input", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    expect(parseInternal(schema, { id }, "getThing")).toEqual({ id });
  });

  it("throws InternalValidationError instead of ZodError on invalid input", () => {
    const parse = () => parseInternal(schema, { id: "not-a-uuid" }, "getThing");

    expect(parse).toThrow(InternalValidationError);
    expect(parse).not.toThrow(ZodError);
  });

  it("preserves the originating ZodError as cause", () => {
    try {
      parseInternal(schema, { id: "not-a-uuid" }, "getThing");
      expect.unreachable("parseInternal should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InternalValidationError);
      expect((error as InternalValidationError).cause).toBeInstanceOf(ZodError);
      expect((error as InternalValidationError).context).toBe("getThing");
    }
  });
});
