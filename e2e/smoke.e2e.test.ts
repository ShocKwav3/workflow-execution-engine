import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 30_000;

async function request<T>(
  method: "GET" | "POST",
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { ...init, method });

  const body = await response.text();

  expect(response.ok, `${method} ${path} returned ${response.status}: ${body}`).toBe(true);

  return JSON.parse(body) as T;
}

function post<T>(path: string, payload: unknown, headers: Record<string, string> = {}): Promise<T> {
  return request<T>("POST", path, {
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

describe("smoke", () => {
  it("runs a published workflow to COMPLETED", async () => {
    const workflow = await post<{ id: string }>("/api/v1/workflows", {
      name: `e2e-smoke-${Date.now()}`,
    });

    const versionsPath = `/api/v1/workflows/${workflow.id}/versions`;
    const version = await post<{ id: string }>(versionsPath, { version: 1 });

    await post(`${versionsPath}/${version.id}/nodes`, {
      name: "e2e-smoke-node",
      type: "e2e-smoke",
      config: { durationSeconds: 0 },
    });
    await post(`${versionsPath}/${version.id}/publish`, {});

    const correlationId = randomUUID();
    const executionsPath = `/api/v1/workflows/${workflow.id}/executions`;

    const { executionId } = await post<{ executionId: string }>(
      executionsPath,
      { workflowVersionId: version.id },
      { "x-correlation-id": correlationId },
    );

    await expect
      .poll(
        async () =>
          (await request<{ status: string }>("GET", `${executionsPath}/${executionId}`)).status,
        {
          interval: POLL_INTERVAL_MS,
          timeout: POLL_TIMEOUT_MS,
          message: `execution ${executionId} did not reach COMPLETED (correlationId ${correlationId})`,
        },
      )
      .toBe("COMPLETED");
  });
});
