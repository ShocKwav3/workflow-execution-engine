import { readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApp } from "@/app.js";
import { loadAppConfig } from "@/config.js";
import { registerRoutes } from "@/routes/index.js";
import type { Resolver } from "@workflow-engine/core/di/types.js";

const specDir = path.resolve(process.cwd(), "spec");

// Filesystem path (not a module specifier, so aliases don't apply) — adding routes/v2/ later needs no change here.
const apiVersionsDir = path.resolve(process.cwd(), "src/routes");
const versionDirPattern = /^v\d+$/;

// Allowlist, not a __tests__ denylist — any future non-version folder under routes/ is excluded for free.
const versions = readdirSync(apiVersionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && versionDirPattern.test(entry.name))
  .map((entry) => entry.name);

// Route registration never resolves anything at registration time — only handlers do, at
// request time. Spec generation never fires a request against a business route (it only
// hits swagger-ui's own /json route per version), so a stub is enough — keeps `pg` out of
// this script's import graph entirely, same guarantee Task 3 established for the bare app shell.
const specResolver: Resolver = {
  resolve() {
    throw new Error("Resolver not available during OpenAPI spec generation");
  },
};

const app = await buildApp({ ...loadAppConfig(), logLevel: "silent" });

await app.register(registerRoutes, { container: specResolver });
await app.ready();

for (const version of versions) {
  const response = await app.inject({ method: "GET", url: `/api/${version}/docs/yaml` });

  if (response.statusCode !== 200) {
    throw new Error(
      `Spec generation for ${version} returned ${response.statusCode}: ${response.body}`,
    );
  }

  const versionDir = path.join(specDir, version);
  const outputPath = path.join(versionDir, "openapi.yaml");

  await mkdir(versionDir, { recursive: true });
  await writeFile(outputPath, response.body);
  console.log(`OpenAPI spec written to ${outputPath}`);
}

await app.close();
