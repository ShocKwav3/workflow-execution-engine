import type { FastifyInstance } from "fastify";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "@workflow-engine/core/test/testDatabase.js";
import { buildTestApp } from "./testApp.js";

export interface RouteHarness {
  db: TestDatabase;
  app: FastifyInstance;
}

export async function startRouteHarness(): Promise<RouteHarness> {
  const db = await startTestDatabase();
  const app = await buildTestApp(db);

  return { db, app };
}

export async function stopRouteHarness(harness: RouteHarness): Promise<void> {
  await harness.app.close();
  await stopTestDatabase(harness.db);
}

export async function resetRouteHarness(harness: RouteHarness): Promise<void> {
  // outbox_message has no foreign key into workflow, so CASCADE does not reach it.
  await harness.db.pool.query("TRUNCATE workflow, outbox_message CASCADE");
}
