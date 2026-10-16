import { describe, expect, it } from "vitest";
import { isConnectionError } from "@/redis/isConnectionError.js";

function errorWithCode(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe("isConnectionError", () => {
  it("is true for a failed name lookup", () => {
    expect(isConnectionError(errorWithCode("getaddrinfo ENOTFOUND redis", "ENOTFOUND"))).toBe(true);
  });

  it("is true for a refused connection", () => {
    expect(
      isConnectionError(errorWithCode("connect ECONNREFUSED 127.0.0.1:6379", "ECONNREFUSED")),
    ).toBe(true);
  });

  it("is true for a command on a closed connection", () => {
    expect(isConnectionError(new Error("Connection is closed."))).toBe(true);
  });

  it("is false for a lost job lock", () => {
    expect(isConnectionError(new Error("could not renew lock for job 42"))).toBe(false);
  });

  it("is false for an error with an unrelated code", () => {
    expect(isConnectionError(errorWithCode("permission denied", "EACCES"))).toBe(false);
  });
});
