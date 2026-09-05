import Fastify from "fastify";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseInternal } from "@workflow-engine/core/errors/index.js";
import { errorHandler } from "@/errorHandler.js";

const idSchema = z.uuid();

async function buildErrorApp() {
  const app = Fastify({ logger: false });

  app.setErrorHandler(errorHandler);

  app.get("/internally-constructed", async () => {
    return parseInternal(idSchema, "not-a-uuid", "test.internallyConstructed");
  });

  app.get("/client-derived", async () => {
    return idSchema.parse("not-a-uuid");
  });

  await app.ready();

  return app;
}

describe("errorHandler validation failure mapping", () => {
  let app: Awaited<ReturnType<typeof buildErrorApp>>;

  beforeAll(async () => {
    app = await buildErrorApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports an internally constructed validation failure as 500", async () => {
    const response = await app.inject({ method: "GET", url: "/internally-constructed" });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      title: "Internal Server Error",
    });
  });

  it("does not leak the failing field to the client on a 500", async () => {
    const response = await app.inject({ method: "GET", url: "/internally-constructed" });

    expect(response.json()).not.toHaveProperty("errors");
    expect(response.body).not.toContain("test.internallyConstructed");
  });

  it("still reports a client-derived validation failure as 400", async () => {
    const response = await app.inject({ method: "GET", url: "/client-derived" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });
});
