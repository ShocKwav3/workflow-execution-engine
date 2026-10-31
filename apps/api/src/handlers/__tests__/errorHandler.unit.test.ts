import Fastify from "fastify";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@workflow-engine/core/errors/AppError.js";
import { parseInternal } from "@workflow-engine/core/errors/index.js";
import {
  PROBLEM_DETAILS_MAX_ERRORS,
  PROBLEM_DETAILS_MAX_INSTANCE_LENGTH,
} from "@workflow-engine/core/errors/problemDetails.js";
import { errorHandler } from "@/handlers/errorHandler.js";

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

  app.post("/echo", async (request) => {
    return request.body;
  });

  app.route({ method: "QUERY", url: "/echo", handler: async (request) => request.body });

  app.get("/many-errors", async () => {
    throw new AppError(400, "VALIDATION_ERROR", "Bad Request", "Request validation failed", {
      errors: Array.from({ length: PROBLEM_DETAILS_MAX_ERRORS + 1 }, (_, index) => ({ index })),
    });
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

describe("errorHandler Fastify client error mapping", () => {
  let app: Awaited<ReturnType<typeof buildErrorApp>>;

  beforeAll(async () => {
    app = await buildErrorApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    {
      name: "an invalid JSON body",
      request: {
        method: "POST",
        url: "/echo",
        headers: { "content-type": "application/json" },
        payload: "\u0000",
      },
      status: 400,
      code: "FST_ERR_CTP_INVALID_JSON_BODY",
    },
    {
      name: "an unsupported content type",
      request: {
        method: "POST",
        url: "/echo",
        headers: { "content-type": "multipart/form-data" },
        payload: "{}",
      },
      status: 415,
      code: "FST_ERR_CTP_INVALID_MEDIA_TYPE",
    },
    {
      name: "a QUERY request to a QUERY route without a content type",
      request: { method: "QUERY", url: "/echo" },
      status: 400,
      code: "FST_ERR_ROUTE_MISSING_CONTENT_TYPE",
    },
  ] as const)("reports $name as $status", async ({ request, status, code }) => {
    const response = await app.inject(request);

    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status, code });
  });
});

describe("errorHandler response limits", () => {
  let app: Awaited<ReturnType<typeof buildErrorApp>>;

  beforeAll(async () => {
    app = await buildErrorApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("caps the errors list at the schema limit", async () => {
    const response = await app.inject({ method: "GET", url: "/many-errors" });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toHaveLength(PROBLEM_DETAILS_MAX_ERRORS);
  });

  it("caps the instance at the schema limit", async () => {
    const url = `/many-errors?q=${"a".repeat(PROBLEM_DETAILS_MAX_INSTANCE_LENGTH)}`;
    const response = await app.inject({ method: "GET", url });

    expect(response.json().instance).toBe(url.slice(0, PROBLEM_DETAILS_MAX_INSTANCE_LENGTH));
  });
});
