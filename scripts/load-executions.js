import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

const BASE_URL = __ENV.LOAD_TEST_BASE_URL || "http://localhost:3000";
const DURATION = __ENV.LOAD_TEST_DURATION || "3m";
const SUMMARY_FILE = __ENV.LOAD_TEST_SUMMARY_FILE;
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

export const options = {
  scenarios: {
    executions: {
      executor: "constant-arrival-rate",
      rate: 5,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

function post(path, body) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), JSON_HEADERS);
}

function mustCreate(response, step) {
  if (response.status !== 201) {
    throw new Error(`${step} returned ${response.status}: ${response.body}`);
  }

  return response.json();
}

export function setup() {
  const workflow = mustCreate(
    post("/api/v1/workflows", { name: `load-test-${Date.now()}` }),
    "create workflow",
  );
  const versionPath = `/api/v1/workflows/${workflow.id}/versions`;
  const version = mustCreate(post(versionPath, { version: 1 }), "create version");

  mustCreate(
    post(`${versionPath}/${version.id}/nodes`, {
      name: "load-test-node",
      type: "load-test",
      config: { durationSeconds: 0 },
    }),
    "create node",
  );

  const published = post(`${versionPath}/${version.id}/publish`, {});

  if (published.status >= 300) {
    throw new Error(`publish returned ${published.status}: ${published.body}`);
  }

  return { workflowId: workflow.id, versionId: version.id };
}

export default function ({ workflowId, versionId }) {
  const executionsPath = `/api/v1/workflows/${workflowId}/executions`;
  const created = post(executionsPath, { workflowVersionId: versionId });

  if (!check(created, { "execution created": (r) => r.status === 201 })) {
    return;
  }

  const fetched = http.get(`${BASE_URL}${executionsPath}/${created.json().executionId}`);

  check(fetched, { "execution fetched": (r) => r.status === 200 });
}

// Exporting handleSummary replaces the default console summary, so it is printed here again.
export function handleSummary(data) {
  const outputs = { stdout: textSummary(data, { enableColors: true }) };

  if (SUMMARY_FILE) {
    outputs[SUMMARY_FILE] = textSummary(data, { enableColors: false });
  }

  return outputs;
}
