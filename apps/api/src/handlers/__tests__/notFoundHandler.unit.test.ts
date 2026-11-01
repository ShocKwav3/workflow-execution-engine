import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler } from "@/handlers/errorHandler.js";
import { registerNotFoundHandler } from "@/handlers/notFoundHandler.js";

describe("notFoundHandler", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerNotFoundHandler(app);
    app.get("/items/:id", async () => ({}));
    app.delete("/items/:id", async () => ({}));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers 405 with the allowed methods for a known path", async () => {
    const response = await app.inject({ method: "POST", url: "/items/abc?x=1" });

    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toContain("GET");
    expect(response.headers.allow).toContain("DELETE");
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status: 405, code: "METHOD_NOT_ALLOWED" });
  });

  it("answers 405 for a QUERY without a content type, not the content-type error", async () => {
    const response = await app.inject({ method: "QUERY", url: "/items/abc" });

    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toContain("GET");
    expect(response.json()).toMatchObject({ status: 405, code: "METHOD_NOT_ALLOWED" });
  });

  it("answers 404 for an unknown path", async () => {
    const response = await app.inject({ method: "GET", url: "/unknown" });

    expect(response.statusCode).toBe(404);
    expect(response.headers.allow).toBeUndefined();
    expect(response.json()).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
