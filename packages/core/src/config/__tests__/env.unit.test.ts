import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileValue } from "@/config/env.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "env-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function valueFile(content: string): string {
  const path = join(dir, "value");

  writeFileSync(path, content);

  return path;
}

describe("readFileValue", () => {
  it("returns the file content", () => {
    expect(readFileValue(valueFile("value"))).toBe("value");
  });

  it("strips one trailing newline and keeps other whitespace", () => {
    expect(readFileValue(valueFile("value \n"))).toBe("value ");
  });

  it("throws when the file is empty", () => {
    const path = valueFile("\n");

    expect(() => readFileValue(path)).toThrow(`File is empty: ${path}`);
  });

  it("throws when the file does not exist", () => {
    expect(() => readFileValue(join(dir, "missing"))).toThrow("ENOENT");
  });
});
