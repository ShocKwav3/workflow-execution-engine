import { describe, expect, it } from "vitest";
import { nodeConfigSchema } from "@/schemas/node.schemas.js";

describe("nodeConfigSchema", () => {
  it("accepts an empty config and stores no defaults", () => {
    expect(nodeConfigSchema.parse({})).toEqual({});
  });

  it("accepts a full config unchanged", () => {
    const config = { durationSeconds: 5, crash: { duringRetry: 0 } };

    expect(nodeConfigSchema.parse(config)).toEqual(config);
  });

  it("rejects an unknown top-level key", () => {
    const result = nodeConfigSchema.safeParse({ durationSeconds: 1, retries: 3 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: "unrecognized_keys", keys: ["retries"] });
  });

  it("rejects an unknown key inside crash", () => {
    const result = nodeConfigSchema.safeParse({ crash: { publisherOutbox: 0 } });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      code: "unrecognized_keys",
      path: ["crash"],
      keys: ["publisherOutbox"],
    });
  });

  it.each([
    ["negative durationSeconds", { durationSeconds: -1 }],
    ["fractional durationSeconds", { durationSeconds: 1.5 }],
    ["string durationSeconds", { durationSeconds: "5" }],
    ["negative crash.duringRetry", { crash: { duringRetry: -1 } }],
  ])("rejects %s", (_label, config) => {
    expect(nodeConfigSchema.safeParse(config).success).toBe(false);
  });
});
