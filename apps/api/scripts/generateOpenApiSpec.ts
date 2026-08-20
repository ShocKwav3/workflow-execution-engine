import { readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApp } from "../src/app.js";
import { registerRoutes } from "../src/routes/index.js";
import type { Resolver } from "../src/di/token.js";

const specDir = path.resolve(process.cwd(), "apps/api/spec");

// Mirrors dist/'s compiled layout (same "../src/..." pattern as the imports above) —
// discovering versions from the filesystem means adding routes/api/v2/ later needs
// no change here.
const apiVersionsDir = path.resolve(import.meta.dirname, "../src/routes/api");
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

const app = await buildApp();

await app.register(registerRoutes, { container: specResolver });
await app.ready();

await mkdir(specDir, { recursive: true });

for (const version of versions) {
  const response = await app.inject({ method: "GET", url: `/api/${version}/docs/json` });
  const spec = response.json();
  const outputPath = path.join(specDir, `openapi.${version}.json`);

  await writeFile(outputPath, JSON.stringify(spec, null, 2) + "\n");
  console.log(`OpenAPI spec written to ${outputPath}`);
}

await app.close();
