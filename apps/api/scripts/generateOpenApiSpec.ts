import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApp } from "../src/app.js";

const outputPath = path.resolve(process.cwd(), "apps/api/spec/openapi.json");

const app = await buildApp();

await app.ready();

const spec = app.swagger();

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(spec, null, 2) + "\n");
await app.close();

console.log(`OpenAPI spec written to ${outputPath}`);
