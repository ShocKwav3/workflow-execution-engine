import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { correlationIdSchema } from "@workflow-engine/core/schemas/correlation.schemas.js";
import { buildApp } from "@/app.js";

const HEADER = "x-correlation-id";
const VALID_ID = "3f6c1a2e-8b4d-4c1e-9a7f-2d5e6b8c9a01";

async function buildProbeApp() {
  const app = await buildApp({
    host: "127.0.0.1",
    port: 0,
    log: { logLevel: "silent", logPretty: false },
  });

  app.get("/probe", async (request) => ({ id: request.id }));
  await app.ready();

  return app;
}

describe("correlation id at the HTTP edge", () => {
  let app: Awaited<ReturnType<typeof buildProbeApp>>;

  beforeAll(async () => {
    app = await buildProbeApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("keeps a valid incoming UUID and echoes it back", async () => {
    const response = await app.inject({ url: "/probe", headers: { [HEADER]: VALID_ID } });

    expect(response.json()).toEqual({ id: VALID_ID });
    expect(response.headers[HEADER]).toBe(VALID_ID);
  });

  it("generates a UUID when the header is missing", async () => {
    const response = await app.inject({ url: "/probe" });
    const { id } = response.json<{ id: string }>();

    expect(correlationIdSchema.safeParse(id).success).toBe(true);
    expect(response.headers[HEADER]).toBe(id);
  });

  it.each([
    ["a non-UUID value", "not-a-uuid"],
    ["an oversized value", "x".repeat(10_000)],
    ["an empty value", ""],
    ["a duplicated header", [VALID_ID, VALID_ID]],
  ])("replaces %s with a generated UUID and does not echo it", async (_label, value) => {
    const response = await app.inject({ url: "/probe", headers: { [HEADER]: value } });
    const { id } = response.json<{ id: string }>();

    expect(correlationIdSchema.safeParse(id).success).toBe(true);
    expect(id).not.toBe(value);
    expect(response.headers[HEADER]).toBe(id);
  });
});
