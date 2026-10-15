import { afterEach, describe, expect, it } from "vitest";
import { HealthServer } from "@/health/HealthServer.js";

describe("HealthServer", () => {
  let alive = true;
  let ready = true;
  let server: HealthServer | undefined;

  async function startServer(): Promise<string> {
    server = new HealthServer({ evaluate: () => ({ ready }) }, () => alive, {
      port: 0,
      host: "127.0.0.1",
    });
    await server.start();

    return `http://127.0.0.1:${server.port}`;
  }

  afterEach(async () => {
    await server?.dispose();
    server = undefined;
    alive = true;
    ready = true;
  });

  it("answers /health with 200 when alive and 503 when not alive", async () => {
    const url = await startServer();

    expect((await fetch(`${url}/health`)).status).toBe(200);

    alive = false;
    expect((await fetch(`${url}/health`)).status).toBe(503);
  });

  it("answers /ready by the readiness verdict", async () => {
    const url = await startServer();

    expect((await fetch(`${url}/ready`)).status).toBe(200);

    ready = false;
    expect((await fetch(`${url}/ready`)).status).toBe(503);
  });

  it("ignores the query string", async () => {
    const url = await startServer();

    expect((await fetch(`${url}/ready?probe=1`)).status).toBe(200);
  });

  it("answers an unknown path with 404", async () => {
    const url = await startServer();

    expect((await fetch(`${url}/metrics`)).status).toBe(404);
  });

  it("answers a method other than GET with 405 and an Allow header", async () => {
    const url = await startServer();

    const response = await fetch(`${url}/ready`, { method: "POST" });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("returns a JSON status body", async () => {
    const url = await startServer();

    const ok = await fetch(`${url}/health`);

    ready = false;
    const unavailable = await fetch(`${url}/ready`);

    expect(ok.headers.get("content-type")).toBe("application/json");
    expect(await ok.json()).toEqual({ status: "ok" });
    expect(await unavailable.json()).toEqual({ status: "unavailable" });
  });

  it("answers 503 when a check throws", async () => {
    server = new HealthServer(
      {
        evaluate: () => {
          throw new Error("broken");
        },
      },
      () => true,
      { port: 0, host: "127.0.0.1" },
    );
    await server.start();

    expect((await fetch(`http://127.0.0.1:${server.port}/ready`)).status).toBe(503);
  });

  it("refuses connections after dispose", async () => {
    const url = await startServer();

    await server?.dispose();

    await expect(fetch(`${url}/health`)).rejects.toThrow();
  });

  it("fails to start when the port is already in use", async () => {
    const url = await startServer();
    const port = Number(new URL(url).port);
    const second = new HealthServer({ evaluate: () => ({ ready }) }, () => alive, {
      port,
      host: "127.0.0.1",
    });

    await expect(second.start()).rejects.toMatchObject({ code: "EADDRINUSE" });
  });
});
