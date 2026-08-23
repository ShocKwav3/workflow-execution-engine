import { readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApp } from "../src/app.js";
import { loadAppConfig } from "../src/config.js";
import { registerRoutes } from "../src/routes/index.js";
import type { Resolver } from "../src/di/types.js";

const specDir = path.resolve(process.cwd(), "apps/api/spec");

// Mirrors dist/'s compiled layout (same "../src/..." pattern as the imports above) —
// discovering versions from the filesystem means adding routes/v2/ later needs
// no change here.
const apiVersionsDir = path.resolve(import.meta.dirname, "../src/routes");
const versions = readdirSync(apiVersionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
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
  const versionDir = path.join(specDir, version);
  const outputPath = path.join(versionDir, "openapi.yaml");

  await mkdir(versionDir, { recursive: true });
  await writeFile(outputPath, response.body);
  console.log(`OpenAPI spec written to ${outputPath}`);
}

await app.close();
